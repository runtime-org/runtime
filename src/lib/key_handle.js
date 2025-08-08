import { load } from '@tauri-apps/plugin-store';

let store = null;

async function initStore() {
    if (!store) {
        store = await load('runtime-app.json');
    }
    return store;
}

// api key management
export async function getApiKey(keyName = 'gemini') {
    try {
        const storeInstance = await initStore();
        const apiKey = await storeInstance.get(`api_keys.${keyName}`);
        if (apiKey) {
            return apiKey;
        }
        
        // fallback to environment variable
        if (keyName === 'gemini') {
            return import.meta.env.VITE_GEMINI_API_KEY;
        }
        if (keyName === "posthog") {
            return import.meta.env.VITE_POSTHOG_API_KEY;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting API key:', error);
        // fallback to environment variable
        if (keyName === 'gemini') {
            return import.meta.env.VITE_GEMINI_API_KEY;
        }
        return null;
    }
}

export async function setApiKey(keyName, apiKey) {
    try {
        const storeInstance = await initStore();
        await storeInstance.set(`api_keys.${keyName}`, apiKey);
        await storeInstance.save();
        return true;
    } catch (error) {
        console.error('Error saving API key:', error);
        return false;
    }
}

export async function listApiKeys() {
    try {
        const storeInstance = await initStore();
        const keys = await storeInstance.keys();
        return keys
            .filter(key => key.startsWith('api_keys.'))
            .map(key => key.replace('api_keys.', ''));
    } catch (error) {
        console.error('Error listing API keys:', error);
        return [];
    }
} 