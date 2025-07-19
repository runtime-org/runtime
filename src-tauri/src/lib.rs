mod utils;
mod config;
mod sketchs;
mod network;
mod commands;
mod platform;
mod browser_manager;

use commands::{
    fetch_available_browsers,
    launch_browser,
    disconnect_from_browser,
    validate_connection,
    validate_ws_endpoint,
    scan_for_existing_browsers,
    debug_browser_connection,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_available_browsers,
            launch_browser,
            disconnect_from_browser,
            validate_connection,
            validate_ws_endpoint,
            scan_for_existing_browsers,
            debug_browser_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
