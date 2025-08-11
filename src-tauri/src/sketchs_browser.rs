use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct WebsiteSkills {
    pub domain: String,
    pub skills: Vec<SkillDefinition>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SkillDefinition {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub input: Option<std::collections::HashMap<String, String>>,
    #[serde(default)]
    pub output: Option<String>,
    pub steps: Vec<SkillStep>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SkillStep {
    pub action: String,
    #[serde(default)]
    pub selector: Option<String>,
    #[serde(default)]
    pub input_key: Option<String>,
    #[serde(default)]
    pub index: Option<u32>,
    #[serde(default)]
    pub output_key: Option<String>,
}
