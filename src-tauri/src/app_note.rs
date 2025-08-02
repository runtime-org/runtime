use std::error::Error;
use std::process::Command;

/*
** append text to the last most recent note
*/
pub fn append_note(text: &str) -> Result<(), Box<dyn Error>> {
    let status = Command::new("osascript")
        .arg("append_note.scpt")
        .arg(text)
        .status()?;

    if !status.success() {
        return Err(format!("Failed to append note: {status}").into());
    }
    Ok(())
}

/*
** create a brand new note wiith title and body 
*/
pub fn create_note(title: &str, body: &str) -> Result<(), Box<dyn Error>> {
    let status = Command::new("osascript")
        .arg("create_note.scpt")
        .arg(title)
        .arg(body)
        .status()?;

    if !status.success() {
        return Err(format!("Failed to create note: {status}").into());
    }
    Ok(())
}