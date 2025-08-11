use crate::sketchs::{
    BrowserConfig
};
use crate::platform::detect_browsers;
use crate::network::{
    create_new_page, 
    extract_port_from_ws_url, 
    find_free_port, 
    get_browser_info,
    determine_browser_type, 
    scan_for_existing_browser_instances,
};
use crate::sketchs_browser::WebsiteSkills;
use crate::skills::download_skill_json;
use crate::browser_manager::{get_running_instance, launch_new_instance, sunset_browser_instance};
use crate::apps::call;

fn is_equivalent_selection(selected: &str, running: &str) -> bool {
    if selected == running { return true; }
    selected == "arc" && running == "chrome"
}


#[tauri::command]
pub async fn fetch_available_browsers() -> Result<Vec<BrowserConfig>, String> {
    let browsers = detect_browsers();

    if browsers.is_empty() {
        return Err(
            "No browsers found. Please install Google Chrome, Microsoft Edge, or Arc".to_string(),
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
    let selected_browser = browsers
        .iter()
        .find(|b| b.path == selected_browser_path)
        .ok_or_else(|| "Selected browser not found in available browsers".to_string())?;

    let selected_id = selected_browser.id.as_str();

    if is_equivalent_selection(selected_id, &running_browser_type) {
        Ok(format!(
            "Browser validation passed: {} (reported as {})",
            selected_id, running_browser_type
        ))
    } else {
        Err(format!(
            "Browser mismatch! Selected: {}, Running: {}",
            selected_id, running_browser_type
        ))
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
            let selected_browser = browsers
                .iter()
                .find(|b| b.path == selected_browser_path)
                .ok_or_else(|| "selected browser not found in available browsers".to_string())?;

            let selected_id = selected_browser.id.as_str();

            if is_equivalent_selection(selected_id, &running_browser_type) {
                println!("saved endpoint is valid and matches selected browser");
                Ok(format!(
                    "reconnected to existing {} instance (reported as {})",
                    selected_id, running_browser_type
                ))
            } else {
                Err(format!(
                    "browser mismatch! selected: {}, running: {}",
                    selected_id, running_browser_type
                ))
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
    let target_browser_path = if let Some(p) = browser_path {
        p
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
                let _ = create_new_page(port, Some("https://www.google.com")).await;
            }
        }
        return Ok(ws_url);
    }

    /*
    ** Force Arc => 9222, others => first free from 9222 upward
    */
    let is_arc = target_browser_path.to_lowercase().contains("arc");
    let port = if is_arc {
        match get_browser_info("9222").await {
            Ok((browser_string, _ua)) => {
                if let Some(ws) = scan_for_existing_browser_instances("arc").await {
                    return Ok(ws);
                }
                return Err(format!(
                    "Port 9222 already in use by: {browser_string}. Close it and retry Arc."
                ));
            }
            Err(_) => 9222,
        }
    } else {
        find_free_port(9222).ok_or_else(|| "Failed to find a free port".to_string())?
    };

    /*
    ** Launch
    */
    match launch_new_instance(&target_browser_path, port).await {
        Ok(ws_url) => {
            if !is_arc {
                if let Ok(pstr) = extract_port_from_ws_url(&ws_url) {
                    if let Ok(p) = pstr.parse::<u16>() {
                        let _ = create_new_page(p, Some("https://www.google.com")).await;
                    }
                }
            }
            Ok(ws_url)
        }
        Err(e) => Err(format!("Failed to launch browser: {e}")),
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

#[tauri::command]
pub async fn load_skills(
    domain: &str, 
    company: Option<String>, 
    repo: Option<String>, 
    branch: String
) -> Result<WebsiteSkills, String> {
    println!("loading skills for domain: {}", domain);
    download_skill_json(domain.to_string(), company, repo, branch).await
}

#[tauri::command]
pub async fn call_app(func: String, args: Vec<String>) -> Result<String, String> {
    // run the dispatcher ; map Ok() to () and Err() to String
    let string_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    call(&func, &string_refs)
        .map(|_| "OK".to_string())
        .map_err(|e| e.to_string())
}