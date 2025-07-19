use std::process::{Command, Stdio};
use tokio::sync::Mutex;
use std::time::Duration;
use once_cell::sync::Lazy;
use reqwest::Client;
use crate::sketchs::ManageableBrowserInstance;
use crate::network::{get_browser_websocket_url, scan_for_existing_browser_instances, extract_port_from_ws_url};
use crate::platform::detect_browsers;

pub static MANAGED_BROWSER: Lazy<Mutex<Option<ManageableBrowserInstance>>> = Lazy::new(|| Mutex::new(None));

fn get_allowed_origins() -> String {
    let is_dev = cfg!(debug_assertions);
    
    if is_dev {
        "http://localhost:1420,http://127.0.0.1:1420".to_string()
    } else {
        #[cfg(target_os = "windows")]
        {
            "http://tauri.localhost,https://tauri.localhost".to_string()
        }
        
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            "tauri://localhost,https://tauri.localhost".to_string()
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            "tauri://localhost".to_string()
        }
    }
}

pub async fn get_running_instance(target_browser_path: &str) -> Option<String> {
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
    
    if let Some(instance) = &mut *managed_browser_guard {
        if instance.path == target_browser_path {
            if let Some(ref mut child) = instance.child {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        *managed_browser_guard = None;
                    }
                    Ok(None) => {
                        let client = Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
                        let version_url = format!("http://127.0.0.1:{}/json/version", instance.port);
                        match client.get(&version_url).send().await {
                            Ok(resp) if resp.status().is_success() => {
                                return Some(instance.ws_url.clone());
                            }

                            _ => {
                                *managed_browser_guard = None;
                            }
                        }
                    }
                    Err(_) => {
                        *managed_browser_guard = None;
                    }
                }
            } else {
                let client = Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
                let version_url = format!("http://127.0.0.1:{}/json/version", instance.port);
                match client.get(&version_url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        return Some(instance.ws_url.clone());
                    }
                    _ => {
                        *managed_browser_guard = None;
                    }
                }
            }
        } else {
            *managed_browser_guard = None;
        }
    }
    
    let browsers = detect_browsers();
    if let Some(target_browser) = browsers.iter().find(|b| b.path == target_browser_path) {
        if let Some(ws_url) = scan_for_existing_browser_instances(&target_browser.id).await {
            let port = extract_port_from_ws_url(&ws_url).ok()?.parse().ok()?;
            *managed_browser_guard = Some(ManageableBrowserInstance {
                child: None,
                path: target_browser_path.to_string(),
                port,
                ws_url: ws_url.clone(),
                launched_by_app: false,
            });
            
            return Some(ws_url);
        }
    }
    
    None
}

pub async fn launch_new_instance(target_browser_path: &str, port: u16) -> Result<String, String> {
    let allowed_origins = get_allowed_origins();
    let is_dev = cfg!(debug_assertions);

    let is_edge = target_browser_path.to_lowercase().contains("edge") || target_browser_path.to_lowercase().contains("msedge");
    let is_chrome = target_browser_path.to_lowercase().contains("chrome");
    
    let mut command = Command::new(target_browser_path);
    command
        .arg(format!("--remote-debugging-port={}", port))
        .arg(format!("--remote-allow-origins={}", allowed_origins))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-background-timer-throttling")
        .arg("--disable-backgrounding-occluded-windows")
        .arg("--disable-renderer-backgrounding");

    if is_chrome {
        command
            .arg("--disable-background-networking")
            .arg("--disable-default-apps")
            .arg("--disable-sync")
            .arg("--disable-translate")
            .arg("--disable-ipc-flooding-protection");
        
        #[cfg(target_os = "windows")]
        command.arg("--user-data-dir=C:\\temp\\chrome-debug-profile");
        
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        command.arg("--user-data-dir=/tmp/chrome-debug-profile");
    } else if is_edge {
        command
            .arg("--disable-background-networking")
            .arg("--disable-default-apps");
        
        #[cfg(target_os = "windows")]
        command.arg("--user-data-dir=C:\\temp\\edge-debug-profile");
        
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        command.arg("--user-data-dir=/tmp/edge-debug-profile");
    }

    if is_dev {
        command
            .arg("--disable-web-security")
            .arg("--disable-features=VizDisplayCompositor")
            .arg("--ignore-certificate-errors")
            .arg("--allow-running-insecure-content");
    }

    if is_dev {
        command.arg("https://www.google.com");
    } else {
        command.arg("about:blank");
    }

    let mut child_process = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to launch browser: {}", e))?;
    
    tokio::time::sleep(Duration::from_secs(4)).await;

    match child_process.try_wait() {
        Ok(Some(status)) => {
            return Err(format!("Browser process exited immediately with status: {}", status));
        }
        Ok(None) => {
            // Browser process is running
        }
        Err(e) => {
            return Err(format!("Failed to check browser process status: {}", e));
        }
    }

    let version_url = format!("http://127.0.0.1:{}/json/version", port);
    
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    match client.get(&version_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            // Debugging endpoint is accessible
        }
        Ok(_) => {
            // Continue to WebSocket connection attempt
        }
        Err(e) => {
            let _ = child_process.kill();
            let _ = child_process.wait();
            return Err(format!("Browser launched but debugging endpoint is not accessible. This usually means the browser didn't enable remote debugging properly. Error: {}", e));
        }
    }

    match get_browser_websocket_url(port, 20, 500).await {
        Ok(ws_url) => {
            let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
            *managed_browser_guard = Some(ManageableBrowserInstance {
                path: target_browser_path.to_string(),
                port,
                ws_url: ws_url.clone(),
                child: Some(child_process),
                launched_by_app: true,
            });
            Ok(ws_url)
        },
        Err(e) => {
            let _ = child_process.kill();
            let _ = child_process.wait();
            Err(format!("Failed to establish debugging connection: {}. The browser launched but DevTools Protocol is not responding.", e))
        }
    }
}

pub async fn sunset_browser_instance() -> Result<(), String> {
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
    
    if let Some(_instance) = managed_browser_guard.take() {
        Ok(())
    } else {
        Ok(())
    }
}
