//! Live activity of the Mac for the Processes view: system load, sensors
//! and each process's CPU and memory, grouped by application.
//!
//! CPU is measured like top: CPU time consumed between two samples, per
//! process. macOS only exposes it, and the memory footprint, for the user's
//! own processes; other processes keep the averaged values of ps.
//!
//! Every CPU figure is a share of the whole Mac (all cores = 100 %), unlike
//! top where 100 % is one core: the processes add up to the system gauge.
use crate::i18n::l;
use crate::{
    model::ProcessSummary,
    process::{self, ProcessEntry},
    scan,
    sensors::{self, Sensors},
};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap},
    ffi::CString,
    path::Path,
    sync::OnceLock,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    /// Share of the whole machine, 0–100: programs plus kernel.
    pub cpu_percent: f32,
    /// Time spent running the code of programs (user mode).
    pub programs_percent: f32,
    /// Time spent in the macOS kernel (system mode).
    pub kernel_percent: f32,
    /// Gauge minus the sum of every process: kernel_task, interrupts,
    /// memory compression, processes that came and went between samples.
    /// top leaves the same gap between its total and its processes.
    pub unattributed_percent: f32,
    pub cores: u32,
    /// App memory, wired and compressed, as counted by Activity Monitor.
    pub memory_used: u64,
    pub memory_total: u64,
    /// "normal", "warning" or "critical".
    pub memory_pressure: &'static str,
    pub swap_used: u64,
    pub swap_total: u64,
    pub process_count: usize,
    pub own_count: usize,
    /// Temperatures, fans, GPU and power.
    pub sensors: Sensors,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub id: String,
    pub pid: u32,
    pub name: String,
    pub path: String,
    pub command: String,
    /// Belongs to the user running Portlight.
    pub own: bool,
    /// Share of the whole Mac, like the system gauge: all cores = 100.
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    /// CPU measured between two samples; false for a process started since
    /// the last one, which shows the ps average.
    pub precise: bool,
    /// Memory footprint, as in Activity Monitor; otherwise resident memory,
    /// the only figure macOS gives for other users' processes.
    pub exact_memory: bool,
    pub elapsed_seconds: u64,
    pub stoppable: bool,
    pub reason: Option<String>,
    #[serde(skip)]
    pub identity: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppGroup {
    pub id: String,
    pub name: String,
    pub bundle: String,
    /// The application process itself, the one asked to quit.
    pub main_pid: Option<u32>,
    pub own: bool,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub precise: bool,
    pub exact_memory: bool,
    pub elapsed_seconds: u64,
    pub stoppable: bool,
    pub reason: Option<String>,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySnapshot {
    pub system: SystemStats,
    pub apps: Vec<AppGroup>,
    /// Processes outside an application bundle.
    pub processes: Vec<ProcessInfo>,
    pub sampled_at: u64,
}

/// Counters of the previous sample, to measure what happened since.
pub struct Counters {
    at: Instant,
    cpu_ticks: [u32; 4],
    processes: HashMap<u32, (String, u64)>,
}

/// Commands can be very long (Chrome helpers); the list only needs the start.
const MAX_COMMAND: usize = 300;
/// Beyond this, the previous counters no longer describe "now".
const STALE: Duration = Duration::from_secs(10);
/// First sample: short wait so that the first CPU figures are real.
const WARM_UP: Duration = Duration::from_millis(500);

fn sysctl<T: Copy>(name: &str) -> Option<T> {
    let name = CString::new(name).ok()?;
    let mut value: T = unsafe { std::mem::zeroed() };
    let mut size = std::mem::size_of::<T>();
    let status = unsafe {
        libc::sysctlbyname(
            name.as_ptr(),
            (&mut value as *mut T).cast(),
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    (status == 0).then_some(value)
}

#[allow(deprecated)]
fn host() -> libc::mach_port_t {
    static HOST: OnceLock<libc::mach_port_t> = OnceLock::new();
    *HOST.get_or_init(|| unsafe { libc::mach_host_self() })
}

/// user, system, idle, nice ticks of all cores together.
fn cpu_ticks() -> [u32; 4] {
    let mut info: libc::host_cpu_load_info = unsafe { std::mem::zeroed() };
    let mut count = (std::mem::size_of::<libc::host_cpu_load_info>()
        / std::mem::size_of::<libc::integer_t>())
        as libc::mach_msg_type_number_t;
    let status = unsafe {
        libc::host_statistics(
            host(),
            libc::HOST_CPU_LOAD_INFO,
            (&mut info as *mut libc::host_cpu_load_info).cast(),
            &mut count,
        )
    };
    if status == 0 {
        info.cpu_ticks
    } else {
        [0; 4]
    }
}

/// Share of the machine spent in programs (user and nice ticks) and in the
/// kernel (system ticks), 0–100 each.
pub fn cpu_share(before: [u32; 4], after: [u32; 4]) -> (f32, f32) {
    let delta: Vec<u64> = after
        .iter()
        .zip(before)
        .map(|(a, b)| a.wrapping_sub(b) as u64)
        .collect();
    let total: u64 = delta.iter().sum();
    if total == 0 {
        return (0.0, 0.0);
    }
    let share = |ticks: u64| (ticks as f32 * 100.0 / total as f32).clamp(0.0, 100.0);
    (share(delta[0] + delta[3]), share(delta[1]))
}

/// Used memory as Activity Monitor counts it: app memory, wired, compressed.
fn memory_used(page: u64) -> u64 {
    let mut info: libc::vm_statistics64 = unsafe { std::mem::zeroed() };
    let mut count = libc::HOST_VM_INFO64_COUNT;
    let status = unsafe {
        libc::host_statistics64(
            host(),
            libc::HOST_VM_INFO64,
            (&mut info as *mut libc::vm_statistics64).cast(),
            &mut count,
        )
    };
    if status != 0 {
        return 0;
    }
    let app = (info.internal_page_count as u64).saturating_sub(info.purgeable_count as u64);
    (app + info.wire_count as u64 + info.compressor_page_count as u64) * page
}

fn cores() -> u32 {
    sysctl::<i32>("hw.logicalcpu").unwrap_or(1).max(1) as u32
}

fn system(
    (programs, kernel): (f32, f32),
    attributed: f32,
    processes: usize,
    own: usize,
) -> SystemStats {
    let page = sysctl::<u64>("hw.pagesize").unwrap_or(16384);
    let swap = sysctl::<libc::xsw_usage>("vm.swapusage");
    let cpu_percent = (programs + kernel).min(100.0);
    SystemStats {
        cpu_percent,
        programs_percent: programs,
        kernel_percent: kernel,
        unattributed_percent: (cpu_percent - attributed).max(0.0),
        cores: cores(),
        memory_used: memory_used(page),
        memory_total: sysctl::<u64>("hw.memsize").unwrap_or(0),
        memory_pressure: match sysctl::<i32>("kern.memorystatus_vm_pressure_level") {
            Some(4) => "critical",
            Some(2) => "warning",
            _ => "normal",
        },
        swap_used: swap.map(|s| s.xsu_used).unwrap_or(0),
        swap_total: swap.map(|s| s.xsu_total).unwrap_or(0),
        process_count: processes,
        own_count: own,
        sensors: sensors::read(),
    }
}

/// CPU time in nanoseconds and memory footprint of one of the user's
/// processes. macOS refuses both for other users' processes.
fn usage(pid: u32) -> Option<(u64, u64)> {
    static TIMEBASE: OnceLock<(u64, u64)> = OnceLock::new();
    let (numer, denom) = *TIMEBASE.get_or_init(timebase);
    let mut info: libc::rusage_info_v4 = unsafe { std::mem::zeroed() };
    let status = unsafe {
        libc::proc_pid_rusage(
            pid as libc::c_int,
            libc::RUSAGE_INFO_V4,
            (&mut info as *mut libc::rusage_info_v4).cast(),
        )
    };
    // The times are Mach ticks, not nanoseconds, on Apple silicon.
    let ticks = info.ri_user_time + info.ri_system_time;
    (status == 0).then(|| {
        (
            (ticks as u128 * numer as u128 / denom as u128) as u64,
            info.ri_phys_footprint,
        )
    })
}

/// Mach ticks → nanoseconds ratio.
#[allow(deprecated)]
fn timebase() -> (u64, u64) {
    let mut info = libc::mach_timebase_info { numer: 1, denom: 1 };
    unsafe { libc::mach_timebase_info(&mut info) };
    (info.numer.max(1) as u64, info.denom.max(1) as u64)
}

fn executable(pid: u32) -> Option<String> {
    let mut buffer = vec![0u8; libc::PROC_PIDPATHINFO_MAXSIZE as usize];
    let length = unsafe {
        libc::proc_pidpath(
            pid as libc::c_int,
            buffer.as_mut_ptr().cast(),
            buffer.len() as u32,
        )
    };
    (length > 0).then(|| String::from_utf8_lossy(&buffer[..length as usize]).into_owned())
}

/// "/Applications/Google Chrome.app/Contents/Frameworks/…/Helper.app/…"
/// belongs to "/Applications/Google Chrome.app": the outermost bundle.
pub fn bundle(path: &str) -> Option<&str> {
    path.find(".app/").map(|index| &path[..index + 4])
}

/// macOS services stay protected; apps in /System/Applications (Notes,
/// Safari…) can be quit like any other.
pub fn native(path: &str) -> bool {
    (path.starts_with("/System/") && !path.contains("/Applications/"))
        || ["/usr/libexec/", "/usr/sbin/", "/sbin/"]
            .iter()
            .any(|prefix| path.starts_with(prefix))
}

pub fn protection(
    entry: &ProcessEntry,
    name: &str,
    path: &str,
    own_uid: u32,
) -> Option<&'static str> {
    if entry.uid != own_uid {
        Some(l(
            "Belongs to macOS or to another user.",
            "Appartient à macOS ou à un autre utilisateur.",
        ))
    } else if entry.pid == std::process::id() {
        Some(l("This is Portlight itself.", "C’est Portlight lui-même."))
    } else if scan::container_engine(name)
        || bundle(path).is_some_and(|b| scan::container_engine(&app_name(b)))
    {
        Some(l(
            "The container engine is protected. Stop the relevant container.",
            "Le moteur de conteneurs est protégé. Arrêtez le conteneur concerné.",
        ))
    } else if native(path) {
        Some(l("macOS service, protected.", "Service de macOS, protégé."))
    } else if entry.zombie {
        Some(l(
            "Already exited, waiting for its parent.",
            "Déjà terminé, en attente de son parent.",
        ))
    } else {
        None
    }
}

fn app_name(bundle: &str) -> String {
    Path::new(bundle)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| bundle.to_owned())
}

fn truncate(text: &str) -> String {
    match text.char_indices().nth(MAX_COMMAND) {
        Some((index, _)) => format!("{}…", &text[..index]),
        None => text.to_owned(),
    }
}

/// CPU time in nanoseconds: nanosecond precision for the user's processes,
/// the 10 ms of ps for the others. Both are CPU time consumed, so every
/// process is measured the same way.
fn cpu_time(entry: &ProcessEntry, measured: Option<(u64, u64)>) -> u64 {
    measured
        .map(|(ns, _)| ns)
        .unwrap_or(entry.cpu_time_ms * 1_000_000)
}

fn counters(table: &HashMap<u32, ProcessEntry>) -> Counters {
    let own_uid = unsafe { libc::geteuid() };
    Counters {
        at: Instant::now(),
        cpu_ticks: cpu_ticks(),
        processes: table
            .values()
            .map(|p| {
                let measured = (p.uid == own_uid).then(|| usage(p.pid)).flatten();
                (p.pid, (p.identity.clone(), cpu_time(p, measured)))
            })
            .collect(),
    }
}

/// Main process of an application: its own executable, started by launchd.
pub fn main_process<'a>(
    bundle: &str,
    members: &[&'a ProcessInfo],
    parents: &HashMap<u32, u32>,
) -> Option<&'a ProcessInfo> {
    let executables = format!("{bundle}/Contents/MacOS/");
    members
        .iter()
        .filter(|p| p.path.starts_with(&executables))
        .min_by_key(|p| (parents.get(&p.pid) != Some(&1), p.pid))
        .copied()
}

/// Takes a sample. Without recent counters, measures over a short wait.
pub fn sample(previous: Option<Counters>) -> Result<(ActivitySnapshot, Counters), String> {
    let previous = match previous {
        Some(counters) if counters.at.elapsed() < STALE => counters,
        _ => {
            let counters = counters(&process::table()?);
            thread::sleep(WARM_UP);
            counters
        }
    };
    let table = process::table()?;
    let now = Instant::now();
    let wall = now.duration_since(previous.at).as_nanos().max(1) as f64;
    let cpu = cpu_share(previous.cpu_ticks, cpu_ticks());
    let cores = cores();
    let own_uid = unsafe { libc::geteuid() };
    let mut next = Counters {
        at: now,
        cpu_ticks: cpu_ticks(),
        processes: HashMap::new(),
    };
    let mut infos = Vec::with_capacity(table.len());
    for entry in table.values() {
        let path = executable(entry.pid).unwrap_or_else(|| {
            entry
                .command
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .to_owned()
        });
        let name = Path::new(&path)
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| entry.command.clone());
        let own = entry.uid == own_uid;
        let measured = own.then(|| usage(entry.pid)).flatten();
        let cpu_ns = cpu_time(entry, measured);
        next.processes
            .insert(entry.pid, (entry.identity.clone(), cpu_ns));
        // Both count one core as 100 %.
        let (per_core, precise) = match previous.processes.get(&entry.pid) {
            Some((identity, before)) if *identity == entry.identity => (
                (cpu_ns.saturating_sub(*before) as f64 * 100.0 / wall) as f32,
                true,
            ),
            // Started since the last sample: the ps average will do.
            _ => (entry.cpu, false),
        };
        let (memory_bytes, exact_memory) = match measured {
            Some((_, footprint)) => (footprint, true),
            None => (entry.rss_kb * 1024, false),
        };
        let cpu_percent = per_core / cores as f32;
        let reason = protection(entry, &name, &path, own_uid);
        infos.push(ProcessInfo {
            id: format!("pid:{}", entry.pid),
            pid: entry.pid,
            name,
            path,
            command: truncate(&entry.command),
            own,
            cpu_percent,
            memory_bytes,
            precise,
            exact_memory,
            elapsed_seconds: entry.elapsed,
            stoppable: reason.is_none(),
            reason: reason.map(str::to_owned),
            identity: entry.identity.clone(),
        });
    }
    let own_count = infos.iter().filter(|p| p.own).count();
    let attributed: f32 = infos.iter().map(|p| p.cpu_percent).sum();
    let count = infos.len();
    let parents: HashMap<u32, u32> = table.values().map(|p| (p.pid, p.ppid)).collect();
    let (apps, processes) = group(infos, &parents);
    Ok((
        ActivitySnapshot {
            system: system(cpu, attributed, count, own_count),
            apps,
            processes,
            sampled_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        },
        next,
    ))
}

/// Groups the processes of each application bundle; the others stay alone.
pub fn group(
    infos: Vec<ProcessInfo>,
    parents: &HashMap<u32, u32>,
) -> (Vec<AppGroup>, Vec<ProcessInfo>) {
    let mut bundles: BTreeMap<String, Vec<ProcessInfo>> = BTreeMap::new();
    let mut alone = Vec::new();
    for info in infos {
        match bundle(&info.path) {
            Some(b) => bundles.entry(b.to_owned()).or_default().push(info),
            None => alone.push(info),
        }
    }
    let apps = bundles
        .into_iter()
        .map(|(bundle, mut members)| {
            members.sort_by_key(|p| p.pid);
            let refs: Vec<&ProcessInfo> = members.iter().collect();
            let main = main_process(&bundle, &refs, parents);
            // Without its main process, the app is stopped process by process.
            let (stoppable, reason) = match main {
                Some(main) => (main.stoppable, main.reason.clone()),
                None => (
                    members.iter().all(|p| p.stoppable),
                    members.iter().find_map(|p| p.reason.clone()),
                ),
            };
            AppGroup {
                id: format!("app:{bundle}"),
                name: app_name(&bundle),
                main_pid: main.map(|p| p.pid),
                own: members.iter().any(|p| p.own),
                cpu_percent: members.iter().map(|p| p.cpu_percent).sum(),
                memory_bytes: members.iter().map(|p| p.memory_bytes).sum(),
                precise: members.iter().all(|p| p.precise),
                exact_memory: members.iter().all(|p| p.exact_memory),
                elapsed_seconds: main.map(|p| p.elapsed_seconds).unwrap_or_else(|| {
                    members.iter().map(|p| p.elapsed_seconds).max().unwrap_or(0)
                }),
                stoppable,
                reason,
                bundle,
                processes: members,
            }
        })
        .collect();
    (apps, alone)
}

/// What a stop request designates, resolved from the last sample.
pub enum Target {
    /// Quit through the application; `members` are signaled when it has
    /// no main process.
    App {
        main: Option<ProcessSummary>,
        members: Vec<ProcessSummary>,
    },
    Process(ProcessSummary),
}

fn summary(p: &ProcessInfo) -> ProcessSummary {
    ProcessSummary {
        pid: p.pid,
        name: p.name.clone(),
        command: p.command.clone(),
        ports: vec![],
        identity: p.identity.clone(),
    }
}

/// Resolves the identifiers sent by the window against the last sample.
pub fn resolve(snapshot: &ActivitySnapshot, id: &str) -> Result<Target, String> {
    let unknown = || -> String {
        l(
            "This process is no longer in the list. Refresh it.",
            "Ce processus n’est plus dans la liste. Actualisez-la.",
        )
        .into()
    };
    if let Some(app) = snapshot.apps.iter().find(|a| a.id == id) {
        if !app.stoppable {
            return Err(app.reason.clone().unwrap_or_else(unknown));
        }
        let main = app
            .main_pid
            .and_then(|pid| app.processes.iter().find(|p| p.pid == pid))
            .map(summary);
        return Ok(Target::App {
            main,
            members: app
                .processes
                .iter()
                .filter(|p| p.stoppable)
                .map(summary)
                .collect(),
        });
    }
    let process = snapshot
        .processes
        .iter()
        .chain(snapshot.apps.iter().flat_map(|a| a.processes.iter()))
        .find(|p| p.id == id)
        .ok_or_else(unknown)?;
    if !process.stoppable {
        return Err(process.reason.clone().unwrap_or_else(unknown));
    }
    Ok(Target::Process(summary(process)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(pid: u32, path: &str) -> ProcessInfo {
        ProcessInfo {
            id: format!("pid:{pid}"),
            pid,
            name: Path::new(path)
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into(),
            path: path.into(),
            command: path.into(),
            own: true,
            cpu_percent: 10.0,
            memory_bytes: 1024,
            precise: true,
            exact_memory: true,
            elapsed_seconds: pid as u64,
            stoppable: true,
            reason: None,
            identity: String::new(),
        }
    }

    #[test]
    fn bundles_and_native_paths() {
        let helper = "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer)";
        assert_eq!(bundle(helper), Some("/Applications/Google Chrome.app"));
        assert_eq!(bundle("/opt/homebrew/bin/node"), None);
        assert!(native(
            "/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder"
        ));
        assert!(native("/usr/libexec/trustd"));
        assert!(!native(
            "/System/Applications/Notes.app/Contents/MacOS/Notes"
        ));
        assert!(!native("/System/Volumes/Preboot/Cryptexes/App/System/Applications/Safari.app/Contents/MacOS/Safari"));
        assert!(!native("/usr/bin/ssh"));
    }

    #[test]
    fn groups_helpers_under_their_application() {
        let chrome = "/Applications/Google Chrome.app";
        let infos = vec![
            info(10, &format!("{chrome}/Contents/Frameworks/X.framework/Helpers/Helper.app/Contents/MacOS/Helper")),
            info(5, &format!("{chrome}/Contents/MacOS/Google Chrome")),
            info(7, "/opt/homebrew/bin/node"),
        ];
        let parents = HashMap::from([(5, 1), (10, 5), (7, 3)]);
        let (apps, alone) = group(infos, &parents);
        assert_eq!(apps.len(), 1);
        let app = &apps[0];
        assert_eq!(app.name, "Google Chrome");
        assert_eq!(app.main_pid, Some(5));
        assert_eq!(app.processes.len(), 2);
        assert_eq!(app.cpu_percent, 20.0);
        assert_eq!(app.elapsed_seconds, 5);
        assert_eq!(alone.len(), 1);
        assert_eq!(alone[0].name, "node");
    }

    #[test]
    fn machine_cpu_share() {
        // 25 user + 5 nice + 10 system + 60 idle ticks.
        assert_eq!(
            cpu_share([100, 50, 1000, 0], [125, 60, 1060, 5]),
            (30.0, 10.0)
        );
        assert_eq!(cpu_share([1, 1, 1, 1], [1, 1, 1, 1]), (0.0, 0.0));
        // Counters wrap around.
        assert_eq!(cpu_share([u32::MAX, 0, 0, 0], [9, 0, 10, 0]), (50.0, 0.0));
    }

    #[test]
    #[ignore = "prints the local activity to compare with top"]
    fn print_activity() {
        let (_, counters) = sample(None).unwrap();
        thread::sleep(Duration::from_secs(2));
        let (s, _) = sample(Some(counters)).unwrap();
        println!("{:?}", s.system);
        let sum: f32 = s
            .processes
            .iter()
            .chain(s.apps.iter().flat_map(|a| a.processes.iter()))
            .map(|p| p.cpu_percent)
            .sum();
        println!(
            "Sum of processes {sum:.1} % + unattributed {:.1} % = gauge {:.1} % ({:.1} programs + {:.1} kernel)",
            s.system.unattributed_percent,
            s.system.cpu_percent,
            s.system.programs_percent,
            s.system.kernel_percent
        );
        let mut apps: Vec<_> = s.apps.iter().collect();
        apps.sort_by(|a, b| b.cpu_percent.total_cmp(&a.cpu_percent));
        for a in apps.iter().take(6) {
            println!(
                "APP {:5.1}% {:6} MB {:>3} procs {} stop={}",
                a.cpu_percent,
                a.memory_bytes >> 20,
                a.processes.len(),
                a.name,
                a.stoppable
            );
        }
        let mut all: Vec<_> = s
            .processes
            .iter()
            .chain(s.apps.iter().flat_map(|a| a.processes.iter()))
            .collect();
        all.sort_by(|a, b| b.cpu_percent.total_cmp(&a.cpu_percent));
        for p in all.iter().take(8) {
            println!(
                "PID {:6} {:5.1}% {:6} MB precise={} {}",
                p.pid,
                p.cpu_percent,
                p.memory_bytes >> 20,
                p.precise,
                p.name
            );
        }
    }

    #[test]
    fn measures_its_own_activity() {
        let (first, counters) = sample(None).unwrap();
        assert!(first.system.memory_total > 0);
        assert!(first.system.memory_used > 0);
        assert!(first.system.cores >= 1);
        let me = first
            .processes
            .iter()
            .chain(first.apps.iter().flat_map(|a| a.processes.iter()))
            .find(|p| p.pid == std::process::id())
            .expect("The test process is listed");
        assert!(me.own && me.memory_bytes > 0);
        assert!(!me.stoppable, "Portlight never stops itself");
        // Burn CPU for a moment: the second sample must see it.
        let start = Instant::now();
        let mut x = 0u64;
        while start.elapsed() < Duration::from_millis(300) {
            x = x.wrapping_mul(31).wrapping_add(7);
        }
        std::hint::black_box(x);
        let (second, _) = sample(Some(counters)).unwrap();
        let me = second
            .processes
            .iter()
            .chain(second.apps.iter().flat_map(|a| a.processes.iter()))
            .find(|p| p.pid == std::process::id())
            .unwrap();
        assert!(me.precise && me.exact_memory);
        // launchd belongs to root: its CPU is measured too, its memory is not exact.
        let launchd = second.processes.iter().find(|p| p.pid == 1).unwrap();
        assert!(launchd.precise && !launchd.exact_memory);
        // Most of one core, as a share of the whole Mac.
        let one_core = 100.0 / second.system.cores as f32;
        assert!(
            me.cpu_percent > one_core * 0.2,
            "Measured {}",
            me.cpu_percent
        );
        assert!(
            me.cpu_percent <= one_core * 1.1,
            "Measured {}",
            me.cpu_percent
        );
    }
}
