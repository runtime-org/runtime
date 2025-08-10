use tauri::{App, Emitter, Manager, include_image};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri_plugin_positioner::{WindowExt, Position};

pub fn init_tray(app: &App) -> tauri::Result<()> {
    /*
    ** menu
    */
    let open_runtime = MenuItemBuilder::new("Open Runtime").id("open_runtime").build(app)?;
    let show_bar     = MenuItemBuilder::new("Show Command Bar").id("show_bar").build(app)?;
    let settings     = MenuItemBuilder::new("Settings").id("settings").build(app)?;
    let quit_item    = MenuItemBuilder::new("Quit").id("quit").build(app)?;
    let tray_menu = MenuBuilder::new(app).items(&[&open_runtime, &show_bar, &settings, &quit_item]).build()?;

    /*
    ** tray builder
    */
    let mut tray = TrayIconBuilder::new()
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "open_runtime" => {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show(); 
                        let _ = win.set_focus();
                    }
                }
                "show_bar" => {
                    if let Some(win) = app.get_webview_window("command_bar") {
                        let _ = win.show(); 
                        let _ = win.set_focus(); 
                        let _ = win.move_window(Position::Center);
                    }
                }
                "settings" => {
                    let _ = app.emit_to("main", "runtime:open-settings", ());
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show(); 
                        let _ = win.set_focus();
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            /*
            ** left click (on mouse UP): toggle floating bar
            ** right click: OS shows the tray menu automatically
            */
            if let TrayIconEvent::Click { button, button_state, .. } = event {
                match (button, button_state) {
                    (MouseButton::Left, MouseButtonState::Up) => {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("command_bar") {
                            let is_vis = win.is_visible().unwrap_or(false);
                            if is_vis {
                                let _ = win.hide();
                            } else {
                                let _ = win.show(); 
                                let _ = win.set_focus(); 
                                let _ = win.move_window(tauri_plugin_positioner::Position::Center);
                            }
                        }
                    }
                    (MouseButton::Right, _) => {
                        // no-op; right-click opens the context menu automatically
                    }
                    _ => {}
                }
            }
        });

    /*
    ** platform-specific tray icons
    */
    #[cfg(target_os = "macos")]
    {
        let icon_1x = include_image!("icons/tray.png");
        tray = tray.icon(icon_1x).icon_as_template(true);
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let icon = include_image!("icons/trayTemplate@2x.png");
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

