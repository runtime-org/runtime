use std::process::{Command, Stdio};
use tokio::sync::Mutex;
use std::time::Duration;
use once_cell::sync::Lazy;
use reqwest::Client;
use crate::sketchs::ManageableBrowserInstance;
use crate::network::{get_browser_websocket_url, scan_for_existing_browser_instances, determine_browser_type, get_browser_info};
use crate::platform::detect_browsers;

static MANAGED_BROWSER: Lazy<Mutex<Option<ManageableBrowserInstance>>> = Lazy::new(|| Mutex::new(None));

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
            // is the child process still running?
            match instance.child.try_wait() {
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
                            println!("failed to reconnect. killing it.");
                            let _ = instance.child.kill();
                            let _ = instance.child.wait();
                            *managed_browser_guard = None;
                        }
                    }
                }
                Err(e) => {
                    println!("failed to check if browser is running: {}. will launch a new one.", e);
                    let _ = instance.child.kill();
                    *managed_browser_guard = None;
                }
            }
        } else {
            println!("Switching browser. Closing prev instance: {}", instance.path);
            let _ = instance.child.kill();
            let _ = instance.child.wait();
            *managed_browser_guard = None;
        }
    }
    
    // No managed instance found, scan for existing browser instances
    let browsers = detect_browsers();
    if let Some(target_browser) = browsers.iter().find(|b| b.path == target_browser_path) {
        println!("No managed instance found. Scanning for existing {} instances...", target_browser.id);
        
        if let Some(ws_url) = scan_for_existing_browser_instances(&target_browser.id).await {
            println!("Found existing {} instance, connecting...", target_browser.id);
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

    let mut command = Command::new(target_browser_path);
    command
        .arg(format!("--remote-debugging-port={}", port))
        .arg(format!("--remote-allow-origins={}", allowed_origins))
        .arg("--no-first-run")
        .arg("--no-default-browser-check");

    if is_dev {
        command
            .arg("--disable-web-security")
            .arg("--disable-features=VizDisplayCompositor");
    }

    // Determine if this is Edge and add Edge-specific arguments if needed
    let is_edge = target_browser_path.to_lowercase().contains("edge") || target_browser_path.to_lowercase().contains("msedge");
    if is_edge {
        println!("Detected Microsoft Edge browser, adding Edge-specific arguments");
        // Add any Edge-specific arguments if needed in the future
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
    
    // Wait a bit longer for the browser to start up
    tokio::time::sleep(Duration::from_secs(3)).await;

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

    match get_browser_websocket_url(port, 15, 1000).await {
        Ok(ws_url) => {
            let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
            *managed_browser_guard = Some(ManageableBrowserInstance {
                path: target_browser_path.to_string(),
                port,
                ws_url: ws_url.clone(),
                child: child_process,
            });
            println!("browser launched successfully with CORS support");
            Ok(ws_url)
        },
        Err(e) => {
            println!("Failed to get WebSocket URL: {}", e);
            // Kill the child process if connection failed
            let _ = child_process.kill();
            let _ = child_process.wait();
            Err(format!("Failed to establish debugging connection: {}", e))
        }
    }
}

pub async fn sunset_browser_instance() -> Result<(), String> {
    println!("attempting to close the debug browser...");
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
    
    if let Some(mut instance) = managed_browser_guard.take() { // .take() removes it from Option
        println!("found managed browser process to close: {}", instance.path);
        
        if instance.child.try_wait().map_err(|e| format!("error checking child process status: {}", e))?.is_none() {
            // let's kill it
            if let Err(e) = instance.child.kill() {
                eprintln!("failed to kill browser process {}: {}", instance.path, e);
                // proceed to wait for it anyway
            }
            
            match instance.child.wait() {
                Ok(status) => println!("browser process {} exited with status: {}", instance.path, status),
                Err(e) => eprintln!("error waiting for browser process {} to exit: {}", instance.path, e),
            }
        } else {
            println!("browser process {} was already exited.", instance.path);
        }
        
        println!("managed browser instance for {} closed and removed.", instance.path);
        Ok(())
    } else {
        println!("no managed browser process was running to close.");
        Ok(())
    }
}
