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
** push simplified page context to history
** if the action is not get_simplified_page_context, push the semantic explanation of the call
** if the action is get_simplified_page_context, push the 60 element of the raw results
*/
export function pushHistory(history: any[], toolName: string, args: any, rawResult: any) {
    
    let semanticResult;
    if (toolName === 'get_simplified_page_context') {
        const userMessage = {
            role: 'user',
            parts: [ { functionCall: { name: toolName, args: { ...args, data: rawResult } } } ]
        }
        history.push(userMessage);
    } else {
        semanticResult = semanticPptrExplanation(toolName, args);
        const userMessage = {
            role: 'user',
            parts: [ { text: semanticResult } ]
        }
        history.push(userMessage);
    }   
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