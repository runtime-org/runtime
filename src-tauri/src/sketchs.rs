use serde::{Deserialize, Serialize};
use std::process::Child;
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct BrowserConfig {
    pub id: String,
    pub name: String,
    pub path: String
}

#[derive(Debug)]
pub struct ManageableBrowserInstance {
    pub child: Option<Child>, 
    pub path: String,
    pub port: u16,
    pub ws_url: String,
    pub launched_by_app: bool, 
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserQuery { 
    pub query: String,
    pub session_id: Option<String>,
    pub current_url: Option<String>,
    pub page_context: Option<serde_json::Value>, 
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LLMActionResponse { 
    pub task_id: String,
    pub action: String,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub thought: Option<String>,
    pub speak_to_user: Option<String>,
    pub session_id: Option<String>, 
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PuppeteerExecutionResult { 
    pub task_id: String,
    pub action: String, 
    pub status: String, 
    pub data: Option<serde_json::Value>,
    pub error_message: Option<String>,
    pub current_url: Option<String>,
    pub page_context: Option<serde_json::Value>, 
}