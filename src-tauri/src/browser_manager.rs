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
        // please if you intent to modify the damn port, please also replicate the change here
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
    
    // First, check if we have a managed browser instance
    if let Some(instance) = &mut *managed_browser_guard {
        if instance.path == target_browser_path {
            if let Some(ref mut child) = instance.child {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        println!("browser process has exited");
                        *managed_browser_guard = None;
                    }
                    Ok(None) => {
                        println!("reusing the runtime instance at {}", instance.port);
                        let client = Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
                        let version_url = format!("http://127.0.0.1:{}/json/version", instance.port);
                        match client.get(&version_url).send().await {
                            Ok(resp) if resp.status().is_success() => {
                                println!("Running at -> {}", instance.ws_url);
                                return Some(instance.ws_url.clone());
                            }

                            _ => {
                                println!("failed to reconnect. clearing instance.");
                                *managed_browser_guard = None;
                            }
                        }
                    }
                    Err(e) => {
                        println!("failed to check if browser is running: {}. clearing instance.", e);
                        *managed_browser_guard = None;
                    }
                }
            } else {
                let client = Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
                let version_url = format!("http://127.0.0.1:{}/json/version", instance.port);
                match client.get(&version_url).send().await {
                    Ok(resp) if resp.status().is_success() => {
                        println!("Existing browser still running at -> {}", instance.ws_url);
                        return Some(instance.ws_url.clone());
                    }
                    _ => {
                        println!("Existing browser no longer available. clearing instance.");
                        *managed_browser_guard = None;
                    }
                }
            }
        } else {
            println!("Switching browser. Clearing previous instance: {}", instance.path);
            *managed_browser_guard = None;
        }
    }
    
    // No managed instance found, scan for existing browser instances
    let browsers = detect_browsers();
    if let Some(target_browser) = browsers.iter().find(|b| b.path == target_browser_path) {
        println!("No managed instance found. Scanning for existing {} instances...", target_browser.id);
        
        if let Some(ws_url) = scan_for_existing_browser_instances(&target_browser.id).await {
            println!("Found existing {} instance, connecting...", target_browser.id);
            
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
    
    println!("No compatible running browser instances found");
    None
}

pub async fn launch_new_instance(target_browser_path: &str, port: u16) -> Result<String, String> {
    let allowed_origins = get_allowed_origins();
    let is_dev = cfg!(debug_assertions);
    
    println!("launching browser: {} with --remote-debugging-port={}", target_browser_path, port);
    println!("environment: {} mode", if is_dev { "development" } else { "production" });
    println!("allowed origins: {}", allowed_origins);

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
        println!("Detected Google Chrome browser, adding Chrome-specific arguments");
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
        println!("Detected Microsoft Edge browser, adding Edge-specific arguments");
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

    println!("Full command: {:?}", command);

    let mut child_process = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to launch browser: {}", e))?;
    
    println!("Waiting for browser to initialize...");
    tokio::time::sleep(Duration::from_secs(4)).await;

    // Verify the process is still running before attempting connection
    match child_process.try_wait() {
        Ok(Some(status)) => {
            return Err(format!("Browser process exited immediately with status: {}", status));
        }
        Ok(None) => {
            println!("Browser process is running, attempting to connect...");
        }
        Err(e) => {
            return Err(format!("Failed to check browser process status: {}", e));
        }
    }

    // First, let's verify the debugging endpoint is accessible
    let version_url = format!("http://127.0.0.1:{}/json/version", port);
    println!("Testing debugging endpoint: {}", version_url);
    
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    match client.get(&version_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            println!("Debugging endpoint is accessible");
        }
        Ok(resp) => {
            println!("Debugging endpoint returned status: {}", resp.status());
        }
        Err(e) => {
            println!("Failed to access debugging endpoint: {}", e);
            let _ = child_process.kill();
            let _ = child_process.wait();
            return Err(format!("Browser launched but debugging endpoint is not accessible. This usually means the browser didn't enable remote debugging properly. Error: {}", e));
        }
    }

    match get_browser_websocket_url(port, 20, 500).await {
        Ok(ws_url) => {
            println!("Successfully obtained WebSocket URL: {}", ws_url);
            let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
            *managed_browser_guard = Some(ManageableBrowserInstance {
                path: target_browser_path.to_string(),
                port,
                ws_url: ws_url.clone(),
                child: Some(child_process),
                launched_by_app: true,
            });
            println!("browser launched successfully with CORS support");
            Ok(ws_url)
        },
        Err(e) => {
            println!("Failed to get WebSocket URL: {}", e);
            // Kill the child process if connection failed
            let _ = child_process.kill();
            let _ = child_process.wait();
            Err(format!("Failed to establish debugging connection: {}. The browser launched but DevTools Protocol is not responding.", e))
        }
    }
}

pub async fn sunset_browser_instance() -> Result<(), String> {
    println!("Disconnecting from browser debugging session...");
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
    
    if let Some(instance) = managed_browser_guard.take() { // .take() removes it from Option
        println!("Found managed browser instance: {}", instance.path);
        
        if instance.launched_by_app {
            println!("Browser was launched by the app, but keeping it running as requested");
        } else {
            println!("Browser was an existing instance, keeping it running");
        }
        
        println!("Disconnected from browser debugging session. Browser remains open.");
        Ok(())
    } else {
        println!("No managed browser instance to disconnect from.");
        Ok(())
    }
}
