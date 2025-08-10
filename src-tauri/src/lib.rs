use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_positioner::{WindowExt, Position};

mod app_note;
mod apps;
mod browser_manager;
mod commands;
mod config;
mod network;
mod platform;
mod sketchs;
mod sketchs_browser;
mod skills;
mod utils;
mod tray;

use commands::{
    call_app, debug_browser_connection, disconnect_from_browser, fetch_available_browsers,
    force_close_browser, launch_browser, load_skills, scan_for_existing_browsers,
    validate_connection, validate_ws_endpoint,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            /*
            ** build the floating bar window (hidden by default)
            */
            let bar = WebviewWindowBuilder::new(app, "command_bar", WebviewUrl::App("bar.html".into()))
                .decorations(false)
                .always_on_top(true)
                .shadow(true)
                .resizable(false)
                .skip_taskbar(true)
                .visible(false)
                .inner_size(720.0, 60.0)
                .build()?;
            bar.move_window(Position::Center).ok();

            /*
            ** tray icon + menu
            */
            tray::init_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_available_browsers,
            launch_browser,
            disconnect_from_browser,
            force_close_browser,
            validate_connection,
            validate_ws_endpoint,
            scan_for_existing_browsers,
            debug_browser_connection,
            load_skills,
            call_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
