use tauri::{AppHandle, Emitter};

use crate::sketchs::{
    BrowserConfig,
    UserQuery,
    LLMActionResponse,
    PuppeteerExecutionResult
};
use crate::config::BACKEND_BASE_URL;
use crate::platform::detect_browsers;
use crate::network::{
    find_free_port, 
    extract_port_from_ws_url, 
    get_browser_info, 
    determine_browser_type,
    scan_for_existing_browser_instances
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

    // browser info
    let (browser_string, user_agent) = get_browser_info(&port).await?;
    
    // broswer type
    let running_browser_type = determine_browser_type(&browser_string, &user_agent);
    
    // selected browser
    let browsers = detect_browsers();
    let selected_browser = browsers.iter()
        .find(|b| b.path == selected_browser_path);
    
    // selected vs running
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
    
    // First, try to connect to any existing compatible instance
    if let Some(ws_url) = get_running_instance(&target_browser_path).await {
        println!("Successfully connected to existing browser instance");
        return Ok(ws_url);
    }
    
    // No existing instance found, launch a new one
    println!("No existing compatible browser instance found, launching new instance...");
    let port = find_free_port(9222).ok_or_else(|| "Failed to find a free port".to_string())?;
    println!("Found free port: {}", port);
    
    match launch_new_instance(&target_browser_path, port).await {
        Ok(ws_url) => {
            println!("Successfully launched new browser instance");
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
