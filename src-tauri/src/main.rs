#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    if std::env::args().any(|arg| arg == "--scan-json") {
        if let Err(error) = portlight_lib::print_snapshot() {
            eprintln!("{error}");
            std::process::exit(1);
        }
    } else {
        portlight_lib::run();
    }
}
