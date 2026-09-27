use serde::Serialize;

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessSummary {
    pub pid: u32,
    pub name: String,
    pub command: String,
    pub ports: Vec<u16>,
    #[serde(skip)]
    pub identity: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub pid: u32,
    pub name: String,
    pub project: String,
    pub kind: String,
    pub ports: Vec<u16>,
    pub addresses: Vec<String>,
    pub exposed: bool,
    pub command: String,
    pub cwd: String,
    pub elapsed_seconds: u64,
    pub stoppable: bool,
    pub reason: Option<String>,
    pub stop_command: String,
    /// Recent CPU usage reported by ps. Not collected for containers.
    pub cpu_percent: Option<f32>,
    pub memory_bytes: Option<u64>,
    /// Ancestors from the direct parent upwards, launchd excluded.
    pub parents: Vec<ProcessSummary>,
    /// Launcher (npm, turbo, nodemon…) and its descendants, launcher first.
    /// Empty when stopping the whole group is not safe.
    pub launch_group: Vec<ProcessSummary>,
    pub compose_project: Option<String>,
    pub compose_containers: Vec<String>,
    #[serde(skip)]
    pub identity: String,
    #[serde(skip)]
    pub container_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub services: Vec<Service>,
    pub scanned_at: u64,
    pub warnings: Vec<String>,
    pub docker_available: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopResult {
    pub stopped: bool,
    pub message: String,
    pub remaining_ports: Vec<u16>,
}
