use crate::sketchs::BrowserConfig;
use crate::platform::detect_browsers;
use crate::network::{
    create_new_page, 
    extract_port_from_ws_url, 
    find_free_port, 
    get_browser_info,
    determine_browser_type, 
    scan_for_existing_browser_instances,
};
use crate::browser_manager::{
    get_running_instance, 
    launch_new_instance, 
    sunset_browser_instance,
};
use crate::utils::download_and_extract;

#[tauri::command]
pub async fn download_and_extract_resource(url: String) -> Result<String, String> {
    download_and_extract(url).await
}

#[tauri::command]
pub async fn fetch_available_browsers() -> Result<Vec<BrowserConfig>, String> {
    let browsers = detect_browsers();

    if browsers.is_empty() {
        return Err(
            "No browsers found. Please install Google Chrome or Microsoft Edge".to_string(),
        );
    }

    Ok(browsers)
}

#[tauri::command]
pub async fn validate_connection(
    ws_endpoint: String,
    selected_browser_path: String,
) -> Result<String, String> {
    let port = extract_port_from_ws_url(&ws_endpoint)?;

    let (browser_string, user_agent) = get_browser_info(&port).await?;
    let running_browser_type = determine_browser_type(&browser_string, &user_agent);

    let browsers = detect_browsers();
    let selected_browser = browsers.iter().find(|b| b.path == selected_browser_path);

    match selected_browser {
        Some(browser) => {
            if running_browser_type == browser.id {
                Ok(format!("Browser validation passed: {}", browser.id))
            } else {
                Err(format!(
                    "Browser mismatch! Selected: {}, Running: {}",
                    browser.id, running_browser_type
                ))
            }
        }
        None => Err("Selected browser not found in available browsers".to_string()),
    }
}

#[tauri::command]
pub async fn validate_ws_endpoint(
    ws_endpoint: String,
    selected_browser_path: String,
) -> Result<String, String> {
    println!("validating saved endpoint: {}", ws_endpoint); // debug print

    let port = extract_port_from_ws_url(&ws_endpoint)?;

    match get_browser_info(&port).await {
        Ok((browser_string, user_agent)) => {
            let running_browser_type = determine_browser_type(&browser_string, &user_agent);

            let browsers = detect_browsers();
            let selected_browser = browsers.iter().find(|b| b.path == selected_browser_path);

            match selected_browser {
                Some(browser) => {
                    if running_browser_type == browser.id {
                        println!("saved endpoint is valid and matches selected browser");
                        Ok(format!("reconnected to existing {} instance", browser.id))
                    } else {
                        Err(format!(
                            "browser mismatch! selected: {}, running: {}",
                            browser.id, running_browser_type
                        ))
                    }
                }
                None => Err("selected browser not found in available browsers".to_string()),
            }
        }
        Err(e) => {
            println!("saved endpoint is no longer valid: {}", e);
            Err(format!("saved browser connection is no longer available: {}", e))
        }
    }
}

#[tauri::command]
pub async fn launch_browser(browser_path: Option<String>) -> Result<String, String> {
    // decide which executable we want
    let target_browser_path = if let Some(path) = browser_path {
        path
    } else {
        fetch_available_browsers()
            .await?
            .first()
            .map(|b| b.path.clone())
            .ok_or_else(|| "No browser found".to_string())?
    };

    /*
    ** try to reuse an existing instance
    */
    if let Some(ws_url) = get_running_instance(&target_browser_path).await {
        if let Ok(port_str) = extract_port_from_ws_url(&ws_url) {
            if let Ok(port) = port_str.parse::<u16>() {
                /*
                ** open a default page so the tab list isn't empty
                */
                let _ = create_new_page(port, Some("https://www.google.com")).await;
            }
        }
        return Ok(ws_url);
    }

    /*
    ** otherwise launch fresh
    */
    let port =
        find_free_port(9222).ok_or_else(|| "Failed to find a free port".to_string())?;

    match launch_new_instance(&target_browser_path, port).await {
        Ok(ws_url) => {
            let _ = create_new_page(port, Some("https://www.google.com")).await;
            Ok(ws_url)
        }
        Err(e) => Err(format!(
            "Failed to launch browser: {}. Please ensure the browser is properly installed and not running with conflicting arguments.",
            e
        )),
    }
}

#[tauri::command]
pub async fn disconnect_from_browser() -> Result<(), String> {
    sunset_browser_instance().await
}

#[tauri::command]
pub async fn force_close_browser() -> Result<(), String> {
    use crate::browser_manager::MANAGED_BROWSER;
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;

    if let Some(mut instance) = managed_browser_guard.take() {
        if instance.launched_by_app {
            if let Some(ref mut child) = instance.child {
                let _ = child.kill();
                let _ = child.wait();
            }
        } else {
            /*
            ** respect external instances – put it back
            */
            *managed_browser_guard = Some(instance);
        }
        Ok(())
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn scan_for_existing_browsers(browser_type: String) -> Result<Option<String>, String> {
    Ok(scan_for_existing_browser_instances(&browser_type).await)
}

#[tauri::command]
pub async fn debug_browser_connection(browser_path: String) -> Result<String, String> {
    let mut debug_info = Vec::new();
    
    if std::path::Path::new(&browser_path).exists() {
        debug_info.push("Browser executable found".to_string());
    } else {
        return Ok("Browser executable not found at specified path".to_string());
    }
    
    let browsers = detect_browsers();
    if let Some(target_browser) = browsers.iter().find(|b| b.path == browser_path) {
        debug_info.push(format!("Browser detected as: {}", target_browser.id));
        
        if let Some(ws_url) = scan_for_existing_browser_instances(&target_browser.id).await {
            debug_info.push(format!("Found existing {} instance: {}", target_browser.id, ws_url));
            return Ok(debug_info.join("\n"));
        } else {
            debug_info.push("No existing instances found".to_string());
        }
    }
    
    if let Some(port) = find_free_port(9222) {
        debug_info.push(format!("Found free port: {}", port));
        
        debug_info.push("Attempting to launch browser...".to_string());
        
        match launch_new_instance(&browser_path, port).await {
            Ok(ws_url) => {
                debug_info.push(format!("Successfully launched browser with WebSocket: {}", ws_url));

                let _ = sunset_browser_instance().await;
                debug_info.push("🧹 Cleaned up test instance".to_string());
            }
            Err(e) => {
                debug_info.push(format!("Failed to launch browser: {}", e));
            }
        }
    } else {
        debug_info.push("No free ports available".to_string());
    }
    
    Ok(debug_info.join("\n"))
}
