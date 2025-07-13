import { AvailableActions } from './tools.js';

/*
** check if the error is retryable
*/
export function isRetryableError(error: any) {
    const retryablePatterns = [
        /rate limit/i,
        /quota exceeded/i,
        /service unavailable/i,
        /internal server error/i,
        /timeout/i,
        /network/i,
        /connection/i,
        /temporary/i,
        /503/,
        /502/,
        /500/
    ];
    
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    const errorStatus = error.status || '';
    
    return retryablePatterns.some(pattern => 
        pattern.test(errorMessage) || 
        pattern.test(errorCode) || 
        pattern.test(errorStatus)
    );
}

/*
** verify that the output of the LLM is a function call and the function is in the list of available actions
*/
export function isFunctionCall(output: any) {
    const fn = output?.functionCalls?.[0];
    return fn && AvailableActions.includes(fn.name);
}