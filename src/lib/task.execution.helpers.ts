import { taskEventEmitter } from "./emitters";

/*
** get the function call from the response
*/
export function getFnCall(resp: any): { name: string; args: Record<string, any> } | null {
    const call = resp?.functionCalls?.[0];
    return call
}

/*
** emit an event
*/
export function emit(event: string, payload: any) {
    try {
        taskEventEmitter.emit(event, payload);
    } catch (error) { }
}

/*
** trim history
*/
export function trimHistory(
  history: any[],
  keepLatest = 2
) {
    const cleaned = [...history];

    let kept = 0;
    for (let i = cleaned.length - 1; i >= 0; i--) {
        const msg = cleaned[i];

        // Is this a user-role function call to get_simplified_page_context?
        if (
        msg?.role === 'user' &&
        msg.parts?.[0]?.functionCall?.name === 'get_simplified_page_context'
        ) {
        if (kept < keepLatest) {
            kept++;                // keep the payload
            continue;
        }

        // Clone & strip the heavy data
        const clone = JSON.parse(JSON.stringify(msg));
        if (clone.parts?.[0]?.functionCall?.args) {
            clone.parts[0].functionCall.args.data = {};
        }
        cleaned[i] = clone;
        }
    }

    return cleaned;
}

/*
** semantic explanation of the action
*/
export function semanticExplanation(toolName: string, args: any ) {
    let description = '';
    
    switch (toolName) {
        // ===== TASK COMPLETION =====
        case 'done':
            description = args.success ? 'Task completed successfully' : 'Task finished with partial completion';
            break;
            
        // ===== NAVIGATION ACTIONS =====
        case 'search_google':
            description = `Searching Google for "${args.query}"`;
            break;
            
        case 'go_to_url':
            description = `Navigating to ${args.url}`;
            break;
            
        case 'go_back':
            description = 'Going back to the previous page';
            break;
            
        case 'go_forward':
            description = 'Going forward to the next page';
            break;
            
        case 'refresh_page':
            description = 'Refreshing the current page';
            break;
            
        // ===== TIMING/WAITING =====
        case 'wait':
            description = `Waiting ${args.seconds || 3} seconds`;
            break;
            
        // ===== ELEMENT INTERACTION =====
        case 'click_element_by_index':
            description = `Clicking on element ${args.index}`;
            break;
            
        case 'input_text':
            description = `Typing "${args.text}" into element ${args.index}`;
            break;
            
        case 'send_keys':
            description = `Pressing ${args.keys}`;
            break;
            
        // ===== SCROLLING =====
        case 'scroll_down':
            description = args.amount ? `Scrolling down ${args.amount} pixels` : 'Scrolling down';
            break;
            
        case 'scroll_up':
            description = args.amount ? `Scrolling up ${args.amount} pixels` : 'Scrolling up';
            break;
            
        case 'scroll_to_text':
            description = `Scrolling to find "${args.text}"`;
            break;
            
        // ===== DROPDOWN INTERACTIONS =====
        case 'get_dropdown_options':
            description = `Getting dropdown options from element ${args.index}`;
            break;
            
        case 'select_dropdown_option':
            description = `Selecting "${args.text}" from dropdown ${args.index}`;
            break;
            
        // ===== DRAG AND DROP =====
        case 'drag_drop':
            if (args.source_index && args.target_index) {
                description = `Dragging element ${args.source_index} to element ${args.target_index}`;
            } else if (args.source_x && args.target_x) {
                description = `Dragging from (${args.source_x}, ${args.source_y}) to (${args.target_x}, ${args.target_y})`;
            } else {
                description = 'Performing drag and drop action';
            }
            break;
            
        // ===== TAB MANAGEMENT =====
        case 'switch_tab':
            description = `Switching to tab ${args.page_id}`;
            break;
            
        case 'get_all_tabs':
            description = 'Getting all browser tabs';
            break;
            
        case 'get_current_tab':
            description = 'Getting current tab information';
            break;
            
        case 'open_tab':
            description = `Opening new tab with ${args.url}`;
            break;
            
        case 'close_tab':
            description = `Closing tab ${args.page_id}`;
            break;
            
        // ===== CONTENT EXTRACTION =====
        case 'extract_content':
            description = `Extracting content: ${args.goal}`;
            break;
            
        case 'get_accessibility_tree':
            description = `Getting accessibility tree with ${args.number_of_elements} elements`;
            break;
            
        // ===== PAGE STATE/CONTEXT =====
        case 'get_simplified_page_context':
            description = 'Getting page overview';
            break;
            
        case 'save_pdf':
            description = args.filename ? `Saving page as PDF: ${args.filename}` : 'Saving page as PDF';
            break;
            
        // ===== GOOGLE SHEETS SPECIFIC =====
        case 'read_sheet_contents':
            description = 'Reading entire sheet contents';
            break;
            
        case 'read_cell_contents':
            description = `Reading cell ${args.cell_or_range}`;
            break;
            
        case 'update_cell_contents':
            description = `Updating cell ${args.cell_or_range}`;
            break;
            
        case 'clear_cell_contents':
            description = `Clearing cell ${args.cell_or_range}`;
            break;
            
        case 'select_cell_or_range':
            description = `Selecting cell ${args.cell_or_range}`;
            break;
            
        case 'fallback_input_into_single_selected_cell':
            description = `Typing "${args.text}" into selected cell`;
            break;
            
        // ===== FILE OPERATIONS =====
        case 'upload_file':
            description = `Uploading file ${args.file_path} to element ${args.index}`;
            break;
            
        // ===== RUNTIME CONTROL =====
        case 'ask_user':
            description = `Asking user: "${args.question}"`;
            break;
            
        case 'small_talk':
            description = 'Engaging in conversation';
            break;
            
        case 'execute_javascript':
            description = 'Executing custom JavaScript code';
            break;
            
        default:
            description = `Executing ${toolName}`;
            break;
    }
    
    return description;
}

/*
** semantic explanation of the pptr action
*/

export function semanticPptrExplanation(fnName: string, fnArgs: any) {
    let description = '';
    
    switch (fnName) {
        /*
        ** done
        */
        case 'done':
            description = 'Successfully completed the task';
            break;
            
        /*
        ** navigation actions
        */
        case 'search_google':
            description = `Successfully searched Google for "${fnArgs.query}"`;
            break;
            
        case 'go_to_url':
            description = `Successfully navigated to ${fnArgs.url}`;
            break;
            
        case 'go_back':
            description = 'Successfully navigated back to the previous page';
            break;
            
        case 'go_forward':
            description = 'Successfully navigated forward to the next page';
            break;
            
        case 'refresh_page':
            description = 'Successfully refreshed the current page';
            break;
            
        /*
        ** timing/waiting
        */
        case 'wait':
            description = `Successfully waited ${fnArgs.seconds || 3} seconds`;
            break;
            
        /*
        ** element interaction
        */
        case 'click_element_by_index':
            description = `Successfully clicked element ${fnArgs.index}`;
            break;
            
        case 'input_text':
            description = `Successfully entered text "${fnArgs.text}" into element ${fnArgs.index}`;
            break;
            
        /*
        ** scrolling
        */
        case 'scroll_down':
            description = fnArgs.amount ? `Successfully scrolled down ${fnArgs.amount} pixels` : 'Successfully scrolled down';
            break;
            
        case 'scroll_up':
            description = fnArgs.amount ? `Successfully scrolled up ${fnArgs.amount} pixels` : 'Successfully scrolled up';
            break;
            
        case 'scroll_to_text':
            description = `Successfully scrolled to find "${fnArgs.text}"`;
            break;
            
        /*
        ** dropdown interactions
        */
        case 'get_dropdown_options':
            description = `Successfully retrieved dropdown options from element ${fnArgs.index}`;
            break;
            
        case 'select_dropdown_option':
            description = `Successfully selected "${fnArgs.text}" from dropdown ${fnArgs.index}`;
            break;
            
        /*
        ** content extraction
        */
        case 'get_accessibility_tree':
            description = `Successfully retrieved accessibility tree with ${fnArgs.number_of_elements} elements`;
            break;
            
        /*
        ** page state/context
        */
        case 'get_simplified_page_context':
            description = 'Successfully retrieved page context and interactive elements';
            break;
            
        /*
        ** runtime control
        */
        case 'ask_user':
            description = `Successfully asked user: "${fnArgs.question}"`;
            break;
            
        case 'small_talk':
            description = 'Successfully engaged in conversation';
            break;
            
        default:
            description = `Successfully executed ${fnName}`;
            break;
    }
    
    return description;
}