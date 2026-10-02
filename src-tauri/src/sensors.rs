//! Temperatures, fans and power of the Mac, read from the SMC (System
//! Management Controller), and the load of the GPU, read from the I/O
//! Registry. None of them needs administrator rights.
//!
//! Apple does not document the SMC keys; Stats and macmon read the same
//! ones. On Apple silicon, `Tp…` and `Te…` are the sensors of the
//! performance and efficiency cores, `Tg…` those of the GPU, `F0Ac` the
//! speed of the first fan and `PSTR` the power drawn by the whole Mac. A
//! key that is missing or unreadable leaves its figure empty, never guessed.
use core_foundation_sys::{
    base::{kCFAllocatorDefault, CFAllocatorRef, CFEqual, CFGetTypeID, CFRelease, CFTypeRef},
    dictionary::{
        CFDictionaryGetTypeID, CFDictionaryGetValue, CFDictionaryRef, CFMutableDictionaryRef,
    },
    number::{kCFNumberSInt64Type, CFNumberGetTypeID, CFNumberGetValue, CFNumberRef},
    string::{kCFStringEncodingUTF8, CFStringCreateWithCString, CFStringRef},
};
use serde::Serialize;
use std::{
    ffi::{c_char, c_int, c_void, CStr},
    sync::OnceLock,
};

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sensors {
    /// Average of the CPU core sensors, °C.
    pub cpu_celsius: Option<f32>,
    /// Hottest CPU core sensor, °C.
    pub cpu_max_celsius: Option<f32>,
    /// Average of the GPU sensors, °C.
    pub gpu_celsius: Option<f32>,
    /// "nominal", "moderate", "heavy" or "critical", as macOS reports it:
    /// from "heavy" on, macOS slows the Mac down to cool it.
    pub thermal_pressure: Option<&'static str>,
    /// Empty on a Mac without fan; None when the SMC cannot tell (virtual Mac).
    pub fans: Option<Vec<Fan>>,
    /// Device utilization of the GPU, 0–100.
    pub gpu_percent: Option<f32>,
    /// Power drawn by the whole Mac, watts.
    pub power_watts: Option<f32>,
    pub on_battery: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fan {
    pub rpm: f32,
    pub min_rpm: f32,
    pub max_rpm: f32,
}

pub fn read() -> Sensors {
    let mut sensors = Sensors {
        thermal_pressure: thermal_pressure(),
        gpu_percent: gpu_percent(),
        on_battery: on_battery(),
        ..Sensors::default()
    };
    let Some(catalog) = catalog() else {
        return sensors;
    };
    let smc = &catalog.smc;
    if let Some((average, max)) = summary(catalog.cpu.iter().filter_map(|k| smc.read(k))) {
        sensors.cpu_celsius = Some(average);
        sensors.cpu_max_celsius = Some(max);
    }
    sensors.gpu_celsius =
        summary(catalog.gpu.iter().filter_map(|k| smc.read(k))).map(|(average, _)| average);
    sensors.fans = catalog.fans.as_ref().map(|fans| {
        fans.iter()
            .filter_map(|[actual, min, max]| {
                Some(Fan {
                    rpm: smc.read(actual)?.max(0.0),
                    min_rpm: smc.read(min).unwrap_or(0.0),
                    max_rpm: smc.read(max).unwrap_or(0.0),
                })
            })
            .collect()
    });
    sensors.power_watts = catalog
        .power
        .as_ref()
        .and_then(|k| smc.read(k))
        .filter(|w| *w > 0.0);
    sensors
}

/// Average and maximum of the plausible readings: a sensor that is off
/// reads 0 or less.
fn summary(readings: impl Iterator<Item = f32>) -> Option<(f32, f32)> {
    let valid: Vec<f32> = readings.filter(|t| (5.0..=130.0).contains(t)).collect();
    let max = valid.iter().copied().reduce(f32::max)?;
    Some((valid.iter().sum::<f32>() / valid.len() as f32, max))
}

pub fn pressure(level: u64) -> &'static str {
    match level {
        0 => "nominal",
        1 => "moderate",
        2 => "heavy",
        // "trapping" and "sleeping".
        _ => "critical",
    }
}

fn thermal_pressure() -> Option<&'static str> {
    static TOKEN: OnceLock<Option<c_int>> = OnceLock::new();
    let token = (*TOKEN.get_or_init(|| {
        let mut token = 0;
        let status = unsafe {
            notify_register_check(
                c"com.apple.system.thermalpressurelevel".as_ptr(),
                &mut token,
            )
        };
        (status == 0).then_some(token)
    }))?;
    let mut level = 0;
    (unsafe { notify_get_state(token, &mut level) } == 0).then(|| pressure(level))
}

/// Busiest GPU of the I/O Registry, as Activity Monitor's GPU history.
fn gpu_percent() -> Option<f32> {
    let mut iterator = 0;
    let matching = unsafe { IOServiceMatching(c"IOAccelerator".as_ptr()) };
    if unsafe { IOServiceGetMatchingServices(0, matching, &mut iterator) } != 0 {
        return None;
    }
    let statistics = CfString::new(c"PerformanceStatistics");
    let utilization = CfString::new(c"Device Utilization %");
    let mut busiest: Option<f32> = None;
    loop {
        let entry = unsafe { IOIteratorNext(iterator) };
        if entry == 0 {
            break;
        }
        let properties =
            unsafe { IORegistryEntryCreateCFProperty(entry, statistics.0, kCFAllocatorDefault, 0) };
        unsafe { IOObjectRelease(entry) };
        if properties.is_null() {
            continue;
        }
        if let Some(percent) = unsafe { number_in(properties, &utilization) } {
            busiest = Some(busiest.map_or(percent, |b| b.max(percent)));
        }
        unsafe { CFRelease(properties) };
    }
    unsafe { IOObjectRelease(iterator) };
    busiest.map(|p| p.clamp(0.0, 100.0))
}

/// `dictionary[key]` when both are what they should be.
unsafe fn number_in(dictionary: CFTypeRef, key: &CfString) -> Option<f32> {
    if CFGetTypeID(dictionary) != CFDictionaryGetTypeID() {
        return None;
    }
    let value = CFDictionaryGetValue(dictionary as CFDictionaryRef, key.0.cast());
    if value.is_null() || CFGetTypeID(value) != CFNumberGetTypeID() {
        return None;
    }
    let mut number: i64 = 0;
    CFNumberGetValue(
        value as CFNumberRef,
        kCFNumberSInt64Type,
        (&mut number as *mut i64).cast(),
    )
    .then_some(number as f32)
}

/// Desktop Macs report "AC Power" too.
fn on_battery() -> Option<bool> {
    let info = unsafe { IOPSCopyPowerSourcesInfo() };
    if info.is_null() {
        return None;
    }
    let source = unsafe { IOPSGetProvidingPowerSourceType(info) };
    let battery = CfString::new(c"Battery Power");
    let result =
        (!source.is_null()).then(|| unsafe { CFEqual(source.cast(), battery.0.cast()) } != 0);
    unsafe { CFRelease(info) };
    result
}

struct CfString(CFStringRef);

impl CfString {
    fn new(text: &CStr) -> Self {
        Self(unsafe {
            CFStringCreateWithCString(kCFAllocatorDefault, text.as_ptr(), kCFStringEncodingUTF8)
        })
    }
}

impl Drop for CfString {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CFRelease(self.0.cast()) };
        }
    }
}

/// SMC keys worth reading, listed once: the SMC holds about 2,000 keys.
struct Catalog {
    smc: Smc,
    cpu: Vec<Key>,
    gpu: Vec<Key>,
    /// Current, minimum and maximum speed of each fan.
    fans: Option<Vec<[Key; 3]>>,
    power: Option<Key>,
}

fn catalog() -> Option<&'static Catalog> {
    static CATALOG: OnceLock<Option<Catalog>> = OnceLock::new();
    CATALOG
        .get_or_init(|| {
            let smc = Smc::open()?;
            let (mut cpu, mut gpu) = (Vec::new(), Vec::new());
            let count = smc.key("#KEY").and_then(|k| smc.read(&k)).unwrap_or(0.0) as u32;
            for index in 0..count {
                let Some(code) = smc.code_at(index) else {
                    continue;
                };
                let list = match part(&name(code)) {
                    Some(Part::Cpu) => &mut cpu,
                    Some(Part::Gpu) => &mut gpu,
                    None => continue,
                };
                if let Some(info) = smc.info(code).filter(|i| kind(i) == *b"flt ") {
                    list.push(Key { code, info });
                }
            }
            let fans = smc.key("FNum").and_then(|k| smc.read(&k)).map(|count| {
                (0..count as u32)
                    .filter_map(|i| {
                        Some([
                            smc.key(&format!("F{i}Ac"))?,
                            smc.key(&format!("F{i}Mn"))?,
                            smc.key(&format!("F{i}Mx"))?,
                        ])
                    })
                    .collect()
            });
            let power = smc.key("PSTR");
            Some(Catalog {
                smc,
                cpu,
                gpu,
                fans,
                power,
            })
        })
        .as_ref()
}

#[derive(Debug, PartialEq)]
enum Part {
    Cpu,
    Gpu,
}

/// Performance (`Tp`) and efficiency (`Te`) cores, GPU (`Tg`).
fn part(name: &str) -> Option<Part> {
    match name.get(..2)? {
        "Tp" | "Te" => Some(Part::Cpu),
        "Tg" => Some(Part::Gpu),
        _ => None,
    }
}

fn code(name: &str) -> u32 {
    name.bytes().fold(0, |code, b| code << 8 | b as u32)
}

fn name(code: u32) -> String {
    code.to_be_bytes().iter().map(|&b| b as char).collect()
}

fn kind(info: &KeyInfo) -> [u8; 4] {
    info.kind.to_be_bytes()
}

/// Value of a key from its SMC type: little-endian floats on Apple silicon,
/// big-endian integers and fixed-point numbers on Intel.
fn decode(info: &KeyInfo, b: &[u8; 32]) -> Option<f32> {
    let value = match (&kind(info), info.size) {
        (b"flt ", 4) => f32::from_le_bytes([b[0], b[1], b[2], b[3]]),
        (b"fpe2", 2) => u16::from_be_bytes([b[0], b[1]]) as f32 / 4.0,
        (b"sp78", 2) => i16::from_be_bytes([b[0], b[1]]) as f32 / 256.0,
        (b"ui8 ", 1) => b[0] as f32,
        (b"ui16", 2) => u16::from_be_bytes([b[0], b[1]]) as f32,
        (b"ui32", 4) => u32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f32,
        _ => return None,
    };
    value.is_finite().then_some(value)
}

#[derive(Clone, Copy)]
struct Key {
    code: u32,
    info: KeyInfo,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Version {
    major: u8,
    minor: u8,
    build: u8,
    reserved: u8,
    release: u16,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct PowerLimits {
    version: u16,
    length: u16,
    cpu: u32,
    gpu: u32,
    memory: u32,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
struct KeyInfo {
    size: u32,
    kind: u32,
    attributes: u8,
}

/// What the AppleSMC driver takes and returns, 80 bytes.
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct Packet {
    key: u32,
    version: Version,
    limits: PowerLimits,
    info: KeyInfo,
    result: u8,
    status: u8,
    command: u8,
    index: u32,
    bytes: [u8; 32],
}

/// Driver method that takes a Packet.
const HANDLE_EVENT: u32 = 2;
const READ_BYTES: u8 = 5;
const READ_INDEX: u8 = 8;
const READ_KEY_INFO: u8 = 9;

struct Smc {
    connection: u32,
}

impl Smc {
    #[allow(deprecated)]
    fn open() -> Option<Self> {
        let matching = unsafe { IOServiceMatching(c"AppleSMC".as_ptr()) };
        // Consumes `matching`.
        let service = unsafe { IOServiceGetMatchingService(0, matching) };
        if service == 0 {
            return None;
        }
        let mut connection = 0;
        let status = unsafe { IOServiceOpen(service, libc::mach_task_self(), 0, &mut connection) };
        unsafe { IOObjectRelease(service) };
        (status == 0).then_some(Self { connection })
    }

    fn call(&self, input: Packet) -> Option<Packet> {
        let mut output = Packet::default();
        let mut size = std::mem::size_of::<Packet>();
        let status = unsafe {
            IOConnectCallStructMethod(
                self.connection,
                HANDLE_EVENT,
                (&input as *const Packet).cast(),
                size,
                (&mut output as *mut Packet).cast(),
                &mut size,
            )
        };
        (status == 0 && output.result == 0).then_some(output)
    }

    fn info(&self, code: u32) -> Option<KeyInfo> {
        self.call(Packet {
            key: code,
            command: READ_KEY_INFO,
            ..Packet::default()
        })
        .map(|p| p.info)
    }

    fn key(&self, name: &str) -> Option<Key> {
        let code = code(name);
        self.info(code).map(|info| Key { code, info })
    }

    fn code_at(&self, index: u32) -> Option<u32> {
        self.call(Packet {
            command: READ_INDEX,
            index,
            ..Packet::default()
        })
        .map(|p| p.key)
    }

    fn read(&self, key: &Key) -> Option<f32> {
        let packet = self.call(Packet {
            key: key.code,
            info: key.info,
            command: READ_BYTES,
            ..Packet::default()
        })?;
        decode(&key.info, &packet.bytes)
    }
}

#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOServiceMatching(name: *const c_char) -> CFMutableDictionaryRef;
    fn IOServiceGetMatchingService(main_port: u32, matching: CFMutableDictionaryRef) -> u32;
    fn IOServiceGetMatchingServices(
        main_port: u32,
        matching: CFMutableDictionaryRef,
        iterator: *mut u32,
    ) -> c_int;
    fn IOIteratorNext(iterator: u32) -> u32;
    fn IOObjectRelease(object: u32) -> c_int;
    fn IOServiceOpen(service: u32, task: u32, kind: u32, connection: *mut u32) -> c_int;
    fn IOConnectCallStructMethod(
        connection: u32,
        selector: u32,
        input: *const c_void,
        input_size: usize,
        output: *mut c_void,
        output_size: *mut usize,
    ) -> c_int;
    fn IORegistryEntryCreateCFProperty(
        entry: u32,
        key: CFStringRef,
        allocator: CFAllocatorRef,
        options: u32,
    ) -> CFTypeRef;
    fn IOPSCopyPowerSourcesInfo() -> CFTypeRef;
    fn IOPSGetProvidingPowerSourceType(snapshot: CFTypeRef) -> CFStringRef;
}

extern "C" {
    fn notify_register_check(name: *const c_char, token: *mut c_int) -> u32;
    fn notify_get_state(token: c_int, state: *mut u64) -> u32;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(kind: &[u8; 4], size: u32) -> KeyInfo {
        KeyInfo {
            size,
            kind: u32::from_be_bytes(*kind),
            attributes: 0,
        }
    }

    fn bytes(start: &[u8]) -> [u8; 32] {
        let mut b = [0; 32];
        b[..start.len()].copy_from_slice(start);
        b
    }

    #[test]
    fn packet_matches_the_driver_layout() {
        assert_eq!(std::mem::size_of::<Packet>(), 80);
    }

    #[test]
    fn key_names_and_parts() {
        assert_eq!(code("F0Ac"), 0x4630_4163);
        assert_eq!(name(code("PSTR")), "PSTR");
        assert_eq!(part("Tp0A"), Some(Part::Cpu));
        assert_eq!(part("Te05"), Some(Part::Cpu));
        assert_eq!(part("Tg0D"), Some(Part::Gpu));
        assert_eq!(part("TB0T"), None);
        assert_eq!(part("T"), None);
    }

    #[test]
    fn decodes_smc_values() {
        let rpm = 2493.0f32.to_le_bytes();
        assert_eq!(decode(&info(b"flt ", 4), &bytes(&rpm)), Some(2493.0));
        // Intel: 1200 rpm in fixed point 14.2, 45.5 °C in 7.8.
        assert_eq!(
            decode(&info(b"fpe2", 2), &bytes(&[0x12, 0xC0])),
            Some(1200.0)
        );
        assert_eq!(decode(&info(b"sp78", 2), &bytes(&[0x2D, 0x80])), Some(45.5));
        assert_eq!(decode(&info(b"ui8 ", 1), &bytes(&[2])), Some(2.0));
        assert_eq!(
            decode(&info(b"ui32", 4), &bytes(&[0, 0, 7, 167])),
            Some(1959.0)
        );
        assert_eq!(decode(&info(b"flag", 1), &bytes(&[1])), None);
        assert_eq!(
            decode(&info(b"flt ", 4), &bytes(&f32::NAN.to_le_bytes())),
            None
        );
    }

    #[test]
    fn ignores_sensors_that_are_off() {
        assert_eq!(
            summary([50.0, 70.0, -1.6, 0.0].into_iter()),
            Some((60.0, 70.0))
        );
        assert_eq!(summary([0.0].into_iter()), None);
        assert_eq!(summary(std::iter::empty()), None);
    }

    #[test]
    fn thermal_levels() {
        assert_eq!(pressure(0), "nominal");
        assert_eq!(pressure(2), "heavy");
        assert_eq!(pressure(4), "critical");
    }

    /// Virtual Macs (CI) have no sensors: every figure may be missing, but
    /// what is there must be plausible.
    #[test]
    fn reads_this_mac() {
        let start = std::time::Instant::now();
        let first = read();
        let listed = start.elapsed();
        let start = std::time::Instant::now();
        let s = read();
        println!("{s:?}\nFirst read {listed:?}, then {:?}", start.elapsed());
        if let (Some(average), Some(max)) = (s.cpu_celsius, s.cpu_max_celsius) {
            assert!((5.0..=130.0).contains(&average) && average <= max);
        }
        for fan in s.fans.iter().flatten() {
            assert!(fan.rpm >= 0.0 && fan.max_rpm >= fan.min_rpm);
        }
        if let Some(gpu) = s.gpu_percent {
            assert!((0.0..=100.0).contains(&gpu));
        }
        assert_eq!(
            first.fans.map(|f| f.len()),
            s.fans.as_ref().map(|f| f.len())
        );
        // The fields of the Sensors type of the interface, null when missing.
        let json = serde_json::to_value(&s).unwrap();
        for key in [
            "cpuCelsius",
            "cpuMaxCelsius",
            "gpuCelsius",
            "thermalPressure",
            "fans",
            "gpuPercent",
            "powerWatts",
            "onBattery",
        ] {
            assert!(json.get(key).is_some(), "{key} missing");
        }
    }
}
