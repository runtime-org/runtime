use std::path::PathBuf;
use crate::sketchs::BrowserConfig;

pub fn check_browser(id: &str, name: &str, paths: &[&str]) -> Option<BrowserConfig> {
    for path_str in paths {
        let path = PathBuf::from(path_str);

        if path.exists() && path.is_file() {
            println!("Found browser: {} at {}", name, path_str);
            return Some(BrowserConfig {
                id: id.to_string(),
                name: name.to_string(),
                path: path.to_string_lossy().to_string()
            });
        }
    }
    None
}
