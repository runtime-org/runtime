
use std::error::Error;
use crate::app_note::{append_note, create_note};

/*
** app functions 
*/

pub fn call(func: &str, args: &[&str]) -> Result<(), Box<dyn Error>> {
    match func {
        /*
        ** this function basically use osascript to append text to the last most recent note.
        ** it is launching app "Notes" and appending text to the last most recent note.
        */
        "append_note" => {
            if args.len() != 1 {
                return Err(format!("append_note expects 1 argument, but got {}", args.len()).into());
            }
            append_note(&args[0])?;
            Ok(())
        }

        /*
        ** this function also use osascript to create a new note with title and body.
        ** it is launching app "Notes" and creating a new note with title and body.
        */
        "create_note" => {
            if args.len() != 2 {
                return Err(format!("create_note expects 2 arguments, but got {}", args.len()).into());
            }
            create_note(&args[0], &args[1])?;
            Ok(())
        }

        /*************************************************************************************
        ** if the function is not found, return an error in case of unexpected function call.
        */
        _ => {
            return Err(format!("Unknown function: {func}").into());
        }
    }
}