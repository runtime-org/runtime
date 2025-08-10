use crate::sketchs::BrowserConfig;
use std::path::PathBuf;

pub fn check_browser(id: &str, name: &str, paths: &[&str]) -> Option<BrowserConfig> {
    for path_str in paths {
        let path = PathBuf::from(path_str);

        if path.exists() && path.is_file() {
            println!("Found browser: {} at {}", name, path_str);
            return Some(BrowserConfig {
                id: id.to_string(),
                name: name.to_string(),
                path: path.to_string_lossy().to_string(),
            });
        }
    }
    None
}

// pub async fn download_and_extract(url: String) -> Result<String, String> {
//     /*
//     fetch the byte in async mode
//     */
//     let response = reqwest::Client::new()
//         .get(url)
//         .send()
//         .await
//         .map_err(|e| e.to_string())?
//         .error_for_status()
//         .map_err(|e| e.to_string())?;

//     let bytes = response
//         .bytes()
//         .await
//         .map_err(|e| e.to_string())?;
//     /*
//     run the CPU-bound file parsing on a blocking thread
//     */
//     let text = tauri::async_runtime::spawn_blocking(move || {
//         let extractor = Extractor::new()
//             .set_extract_string_max_length(20_000_000); // 20MB

//         extractor
//             .extract_bytes_to_string(&bytes)
//             .map(|(t, _meta)| t)
//             .map_err(|e| e.to_string())
//     }).await
//     .map_err(|e| e.to_string())??;

//     Ok(text)
// }
// }
