import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './key_handle.js';
import { isRetryableError, isFunctionCall } from './llm.engine.helper.js';

// default support gemini
export async function callLLM(props) {
    const { modelId, contents, config = {}, maxRetries = 3, maxFnCallRetries = 5, ignoreFnCallCheck = false } = props;

    /*
    ** get the api key and get the genAI instance
    */
    const apiKey = await getApiKey('gemini');
    if (!apiKey) throw new Error('No Gemini API key found.');

    const genAI = new GoogleGenAI({ apiKey });
    
    /*
    ** convert the contents to the Gemini format
    */
    const convertedContents = contents.map(message => ({
        ...message,
        role: (message.role === 'assistant' || message.role === "system") ? 'model' : message.role
    }));
    
    /*
    ** call the LLM
    */
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await genAI.models.generateContent({
                model: modelId,
                contents: convertedContents, 
                config: config
            });
            console.log("response", response);

            /*
            ** make sure that the response is a valid function call response
            */
            if (!ignoreFnCallCheck && !isFunctionCall(response)) {
                /*
                ** fn call checking max 5 times recursively
                */
                if (maxFnCallRetries > 0) {
                    console.log(`Response is not a function call, retrying... (${5 - maxFnCallRetries + 1}/5)`);
                    return await callLLM({
                        ...props,
                        maxFnCallRetries: maxFnCallRetries - 1
                    });
                } else {
                    console.warn('Function call enforcement failed after 5 attempts, returning last response');
                    return response;
                }
            }

            return response;

        } catch (error) {
            lastError = error;
            console.error(`LLM Call Failed - Attempt ${attempt}/${maxRetries}:`, error.message);
            const isRetryable = isRetryableError(error);
            
            if (!isRetryable || attempt === maxRetries) break;
            
            // exponential backoff (1s, 2s, 4s, 8s, 16s)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error(`LLM call failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}
