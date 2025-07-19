use crate::sketchs::{
    BrowserConfig,
};
use crate::platform::detect_browsers;
use crate::network::{
    find_free_port, 
    extract_port_from_ws_url, 
    get_browser_info, 
    determine_browser_type,
    scan_for_existing_browser_instances,
    create_new_page
};
use crate::browser_manager::{
    get_running_instance,
    launch_new_instance,
    sunset_browser_instance
};

#[tauri::command]
pub async fn fetch_available_browsers() -> Result<Vec<BrowserConfig>, String> {
    let browsers = detect_browsers();

    if browsers.is_empty() {
        return Err("No browsers found. Please install Google Chrome or Microsoft Edge".to_string());
    }

    Ok(browsers)
}

#[tauri::command]
pub async fn validate_connection(ws_endpoint: String, selected_browser_path: String) -> Result<String, String> {
    let port = extract_port_from_ws_url(&ws_endpoint)?;

    let (browser_string, user_agent) = get_browser_info(&port).await?;
    
    let running_browser_type = determine_browser_type(&browser_string, &user_agent);
    
    let browsers = detect_browsers();
    let selected_browser = browsers.iter()
        .find(|b| b.path == selected_browser_path);
    
    match selected_browser {
        Some(browser) => {
            if running_browser_type == browser.id {
                Ok(format!("Browser validation passed: {}", browser.id))
            } else {
                Err(format!("Browser mismatch! Selected: {}, Running: {}", browser.id, running_browser_type))
            }
        }
        None => Err("Selected browser not found in available browsers".to_string())
    }
}

#[tauri::command]
pub async fn launch_browser(browser_path: Option<String>) -> Result<String, String> {
    let target_browser_path = if let Some(path) = browser_path {
        path
    } else {
        fetch_available_browsers().await?
            .first()
            .map(|b| b.path.clone())
            .ok_or_else(|| "No browser found".to_string())?
    };
    
    println!("Attempting to connect to browser: {}", target_browser_path);
    
    if let Some(ws_url) = get_running_instance(&target_browser_path).await {
        println!("Successfully connected to existing browser instance");
        
        if let Ok(port_str) = extract_port_from_ws_url(&ws_url) {
            if let Ok(port) = port_str.parse::<u16>() {

                match create_new_page(port, Some("https://www.google.com")).await {
                    Ok(page_id) => {
                        println!("Created new page with ID: {}", page_id);
                    }
                    Err(e) => {
                        println!("Warning: Could not create new page: {}", e);
                    }
                }
            }
        }
        
        return Ok(ws_url);
    }
    
    // No existing instance found, launch a new one
    println!("No existing compatible browser instance found, launching new instance...");
    let port = find_free_port(9222).ok_or_else(|| "Failed to find a free port".to_string())?;
    println!("Found free port: {}", port);
    
    match launch_new_instance(&target_browser_path, port).await {
        Ok(ws_url) => {
            println!("Successfully launched new browser instance");
            
            match create_new_page(port, Some("https://www.google.com")).await {
                Ok(page_id) => {
                    println!("Created new page with ID: {}", page_id);
                }
                Err(e) => {
                    println!("Warning: Could not create additional new page: {}", e);
                }
            }
            
            Ok(ws_url)
        }
        Err(e) => {
            println!("Failed to launch new browser instance: {}", e);
            Err(format!("Failed to launch browser: {}. Please ensure the browser is properly installed and not running with conflicting arguments.", e))
        }
    }
}

#[tauri::command]
pub async fn disconnect_from_browser() -> Result<(), String> {
    sunset_browser_instance().await
}

#[tauri::command]
pub async fn force_close_browser() -> Result<(), String> {
    println!("Force closing browser process (if launched by app)...");
    
    use crate::browser_manager::MANAGED_BROWSER;
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
    
    if let Some(mut instance) = managed_browser_guard.take() {
        if instance.launched_by_app {
            if let Some(ref mut child) = instance.child {
                println!("Force closing browser launched by app: {}", instance.path);
                if let Err(e) = child.kill() {
                    eprintln!("Failed to kill browser process: {}", e);
                } else {
                    let _ = child.wait();
                    println!("Browser process closed successfully");
                }
            } else {
                println!("Browser was launched by app but no process handle available");
            }
        } else {
            println!("Browser was not launched by app, cannot force close");
            *managed_browser_guard = Some(instance);
        }
        Ok(())
    } else {
        println!("No managed browser instance to close");
        Ok(())
    }
}

#[tauri::command]
pub async fn validate_ws_endpoint(ws_endpoint: String, selected_browser_path: String) -> Result<String, String> {
    println!("validating saved endpoint: {}", ws_endpoint);
    
    let port = extract_port_from_ws_url(&ws_endpoint)?;
    
    match get_browser_info(&port).await {
        Ok((browser_string, user_agent)) => {
            let running_browser_type = determine_browser_type(&browser_string, &user_agent);
            
            let browsers = detect_browsers();
            let selected_browser = browsers.iter()
                .find(|b| b.path == selected_browser_path);
            
            match selected_browser {
                Some(browser) => {
                    if running_browser_type == browser.id {
                        println!("saved endpoint is valid and matches selected browser");
                        Ok(format!("reconnected to existing {} instance", browser.id))
                    } else {
                        Err(format!("browser mismatch! selected: {}, running: {}", browser.id, running_browser_type))
                    }
                }
                None => Err("selected browser not found in available browsers".to_string())
            }
        }
        Err(e) => {
            println!("saved endpoint is no longer valid: {}", e);
            Err(format!("saved browser connection is no longer available: {}", e))
        }
    }
}

#[tauri::command]
pub async fn scan_for_existing_browsers(browser_type: String) -> Result<Option<String>, String> {
    println!("Scanning for existing {} instances...", browser_type);
    Ok(scan_for_existing_browser_instances(&browser_type).await)
}

#[tauri::command]
pub async fn debug_browser_connection(browser_path: String) -> Result<String, String> {
    println!("🔧 Starting browser connection debug for: {}", browser_path);
    
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
