export type Provider = "gemini" | "gemma";
export type Tier = "smart" | "light";

export interface ModelConfig {
    provider: Provider;
    tier: Tier;
    modelId: string;
}

export const MODEL_MAP: Record<Provider, Record<Tier, ModelConfig>> = {
    gemini: {
        smart: { provider: "gemini", tier: "smart", modelId: "gemini-2.5-flash" },
        light: { provider: "gemini", tier: "light", modelId: "gemini-2.5-flash-lite"
        }
    },
    gemma: {
        smart: { provider: "gemma", tier: "smart", modelId: "gemma-3n:e2b" },
        light: { provider: "gemma", tier: "light", modelId: "gemma-3n:e2b"
        }
    }
}

export interface CallLLMProps {
    provider: Provider;
    tier: Tier;
    contents: any[];
    config: any;
    maxRetries?: number;
    maxFnCallRetries?: number;
    ignoreFnCallCheck?: boolean;
}