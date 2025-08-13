use std::process::{Command, Stdio};
use std::time::Duration;

use once_cell::sync::Lazy;
use reqwest::Client;
use tokio::sync::Mutex;

use crate::network::{
    extract_port_from_ws_url, get_browser_websocket_url, scan_for_existing_browser_instances,
};
use crate::platform::detect_browsers;
use crate::sketchs::ManageableBrowserInstance;

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

#[allow(dead_code)]
pub async fn get_running_instance(target_browser_path: &str) -> Option<String> {
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;

    if let Some(instance) = &mut *managed_browser_guard {
        if instance.path == target_browser_path {
            /*
             ** is the child process still running?
             */
            if let Some(ref mut child) = instance.child {
                match child.try_wait() {
                    Ok(Some(_)) => {
                        println!("browser process has exited");
                        *managed_browser_guard = None;
                    }
                    Ok(None) => {
                        println!("reusing the runtime instance at {}", instance.port);
                        let client = Client::builder()
                            .timeout(Duration::from_secs(2))
                            .build()
                            .ok()?;
                        let version_url =
                            format!("http://127.0.0.1:{}/json/version", instance.port);
                        match client.get(&version_url).send().await {
                            Ok(resp) if resp.status().is_success() => {
                                println!("Running at -> {}", instance.ws_url);
                                return Some(instance.ws_url.clone());
                            }
                            _ => {
                                println!("failed to reconnect. killing it.");
                                let _ = child.kill();
                                let _ = child.wait();
                                *managed_browser_guard = None;
                            }
                        }
                    }
                    Err(e) => {
                        println!(
                            "failed to check if browser is running: {e}. will launch a new one."
                        );
                        let _ = child.kill();
                        *managed_browser_guard = None;
                    }
                }
            } else {
                /*
                 ** ping endpoint directly
                 */
                println!("instance had no child handle; checking endpoint availability...");
                let client = Client::builder()
                    .timeout(Duration::from_secs(2))
                    .build()
                    .ok()?;
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
            /*
             ** shut the old one down first
             */
            println!(
                "Switching browser. Closing previous instance: {}",
                instance.path
            );
            if let Some(mut child) = instance.child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
            *managed_browser_guard = None;
        }
    }

    /*
     ** reconnect to the existing instance
     */
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

            println!(
                "reconnected to existing {} instance at {}",
                target_browser.id, ws_url
            );
            return Some(ws_url);
        }
    }

    None
}

/*
** launch a fresh instance
*/
pub async fn launch_new_instance(target_browser_path: &str, port: u16) -> Result<String, String> {
    let is_dev = cfg!(debug_assertions);

    println!("launching browser: {target_browser_path} with --remote-debugging-port={port}");
    println!(
        "environment: {} mode",
        if is_dev { "development" } else { "production" }
    );
    println!("allowed origins: {}", get_allowed_origins());

    let lower = target_browser_path.to_lowercase();
    let is_edge = lower.contains("edge") || lower.contains("msedge");
    let is_chrome = lower.contains("chrome");
    let is_arc = lower.contains("arc");

    let mut command = Command::new(target_browser_path);
    command
        .arg(format!("--remote-debugging-port={port}"))
        .arg("--remote-debugging-address=127.0.0.1")
        .arg(format!("--remote-allow-origins={}", get_allowed_origins()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-background-timer-throttling")
        .arg("--disable-backgrounding-occluded-windows")
        .arg("--disable-renderer-backgrounding")
        .arg("--enable-automation");

    if is_chrome {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        command.arg("--user-data-dir=/tmp/chrome-debug-profile");
    } else if is_edge {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        command.arg("--user-data-dir=/tmp/edge-debug-profile");
    } else if is_arc {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        command.arg("--user-data-dir=/tmp/arc-debug-profile");
    }

    /*
     ** give the browser a moment to finish booting
     */
    let mut child_process = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to launch browser: {e}"))?;

    tokio::time::sleep(Duration::from_secs(2)).await;

    match child_process.try_wait() {
        Ok(Some(status)) => {
            return Err(format!(
                "Browser process exited immediately with status: {status}"
            ))
        }
        Ok(None) => {}
        Err(e) => return Err(format!("Failed to check browser process status: {e}")),
    }

    /*
     ** quick health-check of /json/version for clearer error reporting
     */
    let version_url = format!("http://127.0.0.1:{port}/json/version");
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    match client.get(&version_url).send().await {
        Ok(resp) if resp.status().is_success() => { /* looks good */ }
        Ok(_) => { /* continue – endpoint might not be ready yet */ }
        Err(e) => {
            let _ = child_process.kill();
            let _ = child_process.wait();
            return Err(format!(
                "browser launched but debugging endpoint is not accessible. Error: {e}"
            ));
        }
    }

    /*
     ** finally, fetch the WebSocket URL
     */
    match get_browser_websocket_url(port, 20, 500).await {
        Ok(ws_url) => {
            if is_arc {
                let _ = crate::network::create_new_page(port, Some("https://www.google.com")).await;
            }

            let mut managed_browser_guard = MANAGED_BROWSER.lock().await;
            *managed_browser_guard = Some(ManageableBrowserInstance {
                path: target_browser_path.to_string(),
                port,
                ws_url: ws_url.clone(),
                child: Some(child_process),
                launched_by_app: true,
            });
            println!("browser launched successfully at {ws_url}");
            Ok(ws_url)
        }
        Err(e) => {
            let _ = child_process.kill();
            let _ = child_process.wait();
            Err(format!("Failed to establish debugging connection: {e}"))
        }
    }
}

/*
** gracefully (or forcefully) close the managed browser, if we launched it.
*/
pub async fn sunset_browser_instance() -> Result<(), String> {
    println!("attempting to close the debug browser...");
    let mut managed_browser_guard = MANAGED_BROWSER.lock().await;

    if let Some(mut instance) = managed_browser_guard.take() {
        println!("found managed browser process to close: {}", instance.path);

        if instance.launched_by_app {
            if let Some(mut child) = instance.child.take() {
                if child
                    .try_wait()
                    .map_err(|e| format!("error checking child process status: {e}"))?
                    .is_none()
                {
                    if let Err(e) = child.kill() {
                        eprintln!("failed to kill browser process {}: {}", instance.path, e);
                    }
                    match child.wait() {
                        Ok(status) => println!(
                            "browser process {} exited with status: {status}",
                            instance.path
                        ),
                        Err(e) => eprintln!(
                            "error waiting for browser process {} to exit: {}",
                            instance.path, e
                        ),
                    }
                } else {
                    println!("browser process {} was already exited.", instance.path);
                }
            } else {
                println!("no child handle stored, skipping kill.");
            }
        } else {
            println!("browser was not launched by app; leaving it running.");
        }

        println!(
            "managed browser instance for {} closed and removed.",
            instance.path
        );
        Ok(())
    } else {
        println!("no managed browser process was running to close.");
        Ok(())
    }
}
