use std::net::TcpListener;
use std::time::Duration;
use reqwest::Client;

pub fn find_free_port(start_port: u16) -> Option<u16> {
    let mut port = start_port;
    let _tries = 0;

    while _tries < 100 {
        port += 1;
        if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return Some(port);
        }
    }

    // flalback to 9222
    if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", start_port)) {
        if let Ok(addr) = listener.local_addr() {
            return Some(addr.port());
        }
    }
    None
}
// just to get the port
pub fn extract_port_from_ws_url(ws_endpoint: &str) -> Result<String, String> {
    let url = ws_endpoint.replace("ws://", "http://").replace("wss://", "https://");
    let url_parts: Vec<&str> = url.split('/').collect();
    if url_parts.len() < 3 {
        return Err("Invalid WebSocket URL format".to_string());
    }
    
    let host_port = url_parts[2];
    let port = host_port.split(':').nth(1).unwrap_or("9222");
    Ok(port.to_string())
}

// payload extraction
pub async fn get_browser_info(port: &str) -> Result<(String, String), String> {
    let version_url = format!("http://127.0.0.1:{}/json/version", port);
    
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client.get(&version_url).send().await
        .map_err(|e| format!("Failed to fetch version: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    
    let version_data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    let browser_string = version_data["Browser"].as_str().unwrap_or("").to_string();
    let user_agent = version_data["User-Agent"].as_str().unwrap_or("").to_string();
    
    println!("Browser info: {}", browser_string);
    
    Ok((browser_string, user_agent))
}

pub fn determine_browser_type(browser_string: &str, user_agent: &str) -> String {
    if browser_string.contains("Edg/") || user_agent.contains("Edg/") {
        "edge".to_string()
    } else if browser_string.contains("Chrome/") || user_agent.contains("Chrome/") {
        "chrome".to_string()
    } else {
        "unknown".to_string()
    }
}

pub async fn get_browser_websocket_url(port: u16, max_retries: u32, delay_ms: u64) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    
    let version_url = format!("http://127.0.0.1:{}/json/version", port);
    println!("checking browser: {}", version_url);

    for attempt in 1..=max_retries {
        match client.get(&version_url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let json_data = resp.json::<serde_json::Value>()
                    .await
                    .map_err(|e| format!("failed to parse JSON: {}", e))?;
                
                if let Some(ws_url) = json_data["webSocketDebuggerUrl"].as_str() {
                    println!("running at -> {}", ws_url);
                    return Ok(ws_url.to_string());
                } else {
                    return Err("webSocketDebuggerUrl not found in response".to_string());
                }
            }
            Ok(resp) => {
                println!("attempt {}/{}: browser responded with status {}", attempt, max_retries, resp.status());
            }
            Err(e) => {
                println!("attempt {}/{}: failed to connect to browser: {}", attempt, max_retries, e);
            }
        }

        if attempt < max_retries {
            println!("Retrying in {}ms...", delay_ms);
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }
    }

    Err(format!("failed to connect to browser after {} attempts", max_retries))
}

// pub async fn check_websocket_readiness(ws_url: &str, max_attempts: u32) -> Result<bool, String> {
//     for attempt in 1..=max_attempts {
//         match connect_async(ws_url).await {
//             Ok((mut ws_stream, _)) => {
//                 // ping
//                 if let Ok(_) = ws_stream.send(Message::Ping(vec![])).await {
//                     println!("ws readiness check passed on attempt {}", attempt);
//                     return Ok(true);
//                 }
//             }
//             Err(e) => {
//                 println!("ws readiness check attempt {}/{} failed: {}", attempt, max_attempts, e);
//                 if attempt < max_attempts {
//                     tokio::time::sleep(Duration::from_millis(1000)).await;
//                 }
//             }
//         }
//     }
//     Ok(false)
// }