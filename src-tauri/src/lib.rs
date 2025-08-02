mod utils;
mod skills;
mod apps;
mod app_note;
mod config;
mod sketchs;
mod sketchs_browser;
mod network;
mod commands;
mod platform;
mod browser_manager;

use commands::{
    fetch_available_browsers,
    launch_browser,
    disconnect_from_browser,
    force_close_browser,
    validate_connection,
    validate_ws_endpoint,
    scan_for_existing_browsers,
    debug_browser_connection,
    download_and_extract_resource,
    load_skills,
    call_app
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
            force_close_browser,
            validate_connection,
            validate_ws_endpoint,
            scan_for_existing_browsers,
            debug_browser_connection,
            download_and_extract_resource,
            load_skills,
            call_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
