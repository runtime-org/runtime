use std::{
    fs, 
    error::Error, 
    io::Write, 
    path::PathBuf, 
    process::Command, 
};

fn write_temp_script(bytes: &[u8], stem: &str) -> std::io::Result<PathBuf> {
    let mut path = std::env::temp_dir();
    path.push(format!("{stem}.scpt"));
    let mut file = fs::File::create(&path)?;
    file.write_all(bytes)?;
    Ok(path)
}
/*
** append text to the last most recent note
*/
pub fn append_note(text: &str) -> Result<(), Box<dyn Error>> {
    const APPEND_NOTE: &[u8] = include_bytes!("scripts/append_note.scpt");
    let script_path = write_temp_script(APPEND_NOTE, "append_note")?;
    let status = Command::new("osascript")
        .arg(script_path)   
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
    const CREATE_NOTE: &[u8] = include_bytes!("scripts/create_note.scpt");
    let script_path = write_temp_script(CREATE_NOTE, "create_note")?;
    let status = Command::new("osascript")
        .arg(script_path)  
        .arg(title)
        .arg(body)
        .status()?;

    if !status.success() {
        return Err(format!("Failed to create note: {status}").into());
    }
    Ok(())
}