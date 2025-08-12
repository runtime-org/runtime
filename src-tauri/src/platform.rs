use crate::sketchs::BrowserConfig;
use crate::utils::check_browser;

#[cfg(target_os = "windows")]
pub fn detect_browsers() -> Vec<BrowserConfig> {
    let mut browsers: Vec<BrowserConfig> = Vec::new();

    let program_files =
        std::env::var("PROGRAMFILES").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let program_files_x86 = std::env::var("PROGRAMFILES(X86)")
        .unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();

    let chrome_paths = [
        format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files),
        format!(
            "{}\\Google\\Chrome\\Application\\chrome.exe",
            program_files_x86
        ),
    ];
    if let Some(browser) = check_browser(
        "chrome",
        "Google Chrome",
        &chrome_paths.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    ) {
        browsers.push(browser);
    }

    let edge_paths = [
        format!(
            "{}\\Microsoft\\Edge\\Application\\msedge.exe",
            program_files
        ),
        format!(
            "{}\\Microsoft\\Edge\\Application\\msedge.exe",
            program_files_x86
        ),
    ];
    if let Some(browser) = check_browser(
        "edge",
        "Microsoft Edge",
        &edge_paths.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    ) {
        browsers.push(browser);
    }

    let arc_paths = [
        format!("{}\\Arc\\Application\\Arc.exe", local_app_data),
        format!("{}\\Arc\\Arc.exe", local_app_data),
    ];
    if let Some(browser) = check_browser(
        "arc",
        "Arc",
        &arc_paths.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    ) {
        browsers.push(browser);
    }

    browsers
}

#[cfg(target_os = "macos")]
pub fn detect_browsers() -> Vec<BrowserConfig> {
    let mut browsers: Vec<BrowserConfig> = Vec::new();

    let app_dir = "/Applications";
    let chrome_paths = [format!(
        "{}/Google Chrome.app/Contents/MacOS/Google Chrome",
        app_dir
    )];
    if let Some(browser) = check_browser(
        "chrome",
        "Google Chrome",
        &chrome_paths.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    ) {
        browsers.push(browser);
    }

    let edge_paths = [format!(
        "{}/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        app_dir
    )];
    if let Some(browser) = check_browser(
        "edge",
        "Microsoft Edge",
        &edge_paths.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    ) {
        browsers.push(browser);
    }

    let arc_paths = [format!("{}/Arc.app/Contents/MacOS/Arc", app_dir)];
    if let Some(browser) = check_browser(
        "arc",
        "Arc",
        &arc_paths.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
    ) {
        browsers.push(browser);
    }

    browsers
}

#[cfg(target_os = "linux")]
pub fn detect_browsers() -> Vec<BrowserConfig> {
    let mut browsers: Vec<BrowserConfig> = Vec::new();

    let paths = [
        // common binaries could be symlinks
        (
            "/usr/bin/google-chrome-stable",
            "chrome",
            "Google Chrome Stable",
        ),
        ("/usr/bin/google-chrome", "chrome", "Google Chrome"),
        ("/usr/bin/microsoft-edge", "edge", "Microsoft Edge"),
        (
            "/usr/bin/microsoft-edge-stable",
            "edge",
            "Microsoft Edge Stable",
        ),
        (
            "/usr/bin/microsoft-edge-beta",
            "edge",
            "Microsoft Edge Beta",
        ),
        ("/usr/bin/microsoft-edge-dev", "edge", "Microsoft Edge Dev"),
        ("/usr/bin/arc", "arc", "Arc"),
        ("/usr/local/bin/arc", "arc", "Arc"),
        ("/opt/arc/arc", "arc", "Arc"),
    ];

    for (path_str, id, name) in paths.iter() {
        if Path::new(path_str).exists() {
            if !browsers.iter().any(|b| b.path == *path_str) {
                println!("Found browser: {} at {}", name, path_str);
                browsers.push(BrowserConfig {
                    id: id.to_string(),
                    name: name.to_string(),
                    path: path_str.to_string(),
                });
            }
        }
    }

    browsers
}
