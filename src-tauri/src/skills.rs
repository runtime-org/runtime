use reqwest::Client;
use crate::sketchs_browser::WebsiteSkills;

pub async fn download_skill_json(
    domain: String, 
    company: Option<String>, 
    repo: Option<String>,
    branch: String,
) -> Result<WebsiteSkills, String> {
    let company: String = company.unwrap_or_else(|| "runtime-pro".to_string());
    let repo: String = repo.unwrap_or_else(|| "sk".to_string());
    let url: String = format!("https://raw.githubusercontent.com/{company}/{repo}/{branch}/skills/{domain}.json");
    let text: String = Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download skill file for {domain}: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Failed to download skill file for {company}.{domain}: {e}"))?;

    let parsed: WebsiteSkills = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse skill file for {domain}: {e}"))?;

    Ok(parsed)
}