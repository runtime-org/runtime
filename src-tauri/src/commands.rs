use crate::apps::call;
use crate::browser_manager::{get_running_instance, launch_new_instance, sunset_browser_instance, MANAGED_BROWSER};
use crate::network::{
    create_new_page, determine_browser_type, extract_port_from_ws_url, find_free_port,
    get_browser_info, get_browser_websocket_url, scan_for_existing_browser_instances,
};
use crate::platform::detect_browsers;
use crate::sketchs::{BrowserConfig, ManageableBrowserInstance};
use crate::sketchs_browser::WebsiteSkills;
use crate::skills::download_skill_json;

const CHROME_PORT: u16 = 9522;
const EDGE_PORT:   u16 = 9523;
const ARC_PORT:    u16 = 9524;

fn browser_id_for_path(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.contains("edge") || lower.contains("msedge") {
        "edge"
    } else if lower.contains("arc") {
        "arc"
    } else {
        "chrome"
    }
}
fn static_port_for(id: &str) -> u16 {
    match id {
        "edge" => EDGE_PORT,
        "arc"  => ARC_PORT,
        _      => CHROME_PORT,
    }
}

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
pub async fn validate_connection(ws_endpoint: String, selected_browser_path: String) -> Result<String, String> {
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
            Err(format!(
                "saved browser connection is no longer available: {}",
                e
            ))
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

    let selected_id = browser_id_for_path(&target_browser_path);
    let port = static_port_for(selected_id);

    /*
     ** close any managed instance to free the static port.
     */
    {
        let mut guard = MANAGED_BROWSER.lock().await;
        if let Some(mut inst) = guard.take() {
            if inst.path != target_browser_path || inst.port != port {
                if let Some(mut child) = inst.child.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            } else {
                *guard = Some(inst);
            }
        }
    }

    /*
     ** probe the static port (is anything already listening?)
     */
    match get_browser_info(&port.to_string()).await {
        Ok((browser_string, user_agent)) => {
            let running = determine_browser_type(&browser_string, &user_agent);
            if is_equivalent_selection(selected_id, &running) {
                /*
                 ** reuse existing instance on the static port
                 */
                let ws_url = get_browser_websocket_url(port, 20, 500)
                    .await
                    .map_err(|e| format!("Failed to obtain DevTools websocket: {e}"))?;

                /*
                 ** remember (not launched by us)
                 */
                {
                    let mut managed = MANAGED_BROWSER.lock().await;
                    *managed = Some(ManageableBrowserInstance {
                        path: target_browser_path.clone(),
                        port,
                        ws_url: ws_url.clone(),
                        child: None,
                        launched_by_app: false,
                    });
                }
                let _ = create_new_page(port, Some("https://www.google.com")).await;

                return Ok(ws_url);
            } else {
                return Err(format!(
                    "Static port {port} is already occupied by another browser ({running}). Close it and retry."
                ));
            }
        }
        Err(_) => {
            /*
             ** nothing on that port — proceed to launch a fresh instance on it
             */
        }
    }

    /*
     ** launch on the static port
     */
    match launch_new_instance(&target_browser_path, port).await {
        Ok(ws_url) => {
            /*
             ** starter tab (keeps process alive / makes pages() non-empty)
             */
            if let Ok(pstr) = extract_port_from_ws_url(&ws_url) {
                if let Ok(p) = pstr.parse::<u16>() {
                    let _ = create_new_page(p, Some("https://www.google.com")).await;
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
            debug_info.push(format!(
                "Found existing {} instance: {}",
                target_browser.id, ws_url
            ));
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
                debug_info.push(format!(
                    "Successfully launched browser with WebSocket: {}",
                    ws_url
                ));

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
    branch: String,
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
