import { taskEventEmitter } from "./emitters";
import { callLLM } from "./llm.engine";
import { detectWebsites } from "./task.browser.skill.resolver";
import { SummarizeSegmentDeclaration } from "./task.browser.tools";

/*
** emit an event
*/
export function emit(event: string, payload: any) {
    try {
        taskEventEmitter.emit(event, payload);
    } catch (error) { }
}

/*
** get function call
*/
export function getFnCall(resp: any): { name: string; args: Record<string, any> } | null {
    const call = resp?.functionCalls?.[0];
    return call
}

/**
 * validate domains
 */
function validateDomains(domains: string[]): boolean {
    return domains.every(domain => 
        typeof domain === "string" && 
        domain.includes(".") && 
        domain.split(".").length >= 2
    );
}

/**
 * detect and validate domains
 */
export async function detectDomains({query, steps}: {query: string, steps: string[]}): Promise<string[]> {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const domains = await detectWebsites({query, steps});

            /*
            ** validate domains
            */
            if (domains.length === 0) {
                throw new Error("No domains detected");
            }

            if (!validateDomains(domains)) {
                throw new Error("Invalid domains");
            }

            /*
            ** validation succeeded, return domains
            */
            return domains;

        } catch (error) {
            console.log(`domain detection attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt === maxRetries) {
                /*
                ** final attempt failed, throw the error
                */
                throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
            }
            
            /*
            ** wait a bit before retrying
            */
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    throw new Error("Domain detection failed after all retry attempts");
}

/*
** serialize the results
*/
export function serializeResult(k: string, v: unknown): string {
    if (v == null) return `[${k}] no data`;
  
    /*
    ** primitives
    */
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
      return `[${k}] ${String(v)}`;
  
    /*
    ** array of objects
    */
    if (Array.isArray(v) && v.every(item => typeof item === "object")) {
      return `[${k}] (${v.length} items)\n` +
        v.map((o, i) => `  • ${i}: ${JSON.stringify(o)}`).join("\n");
    }
  
    /*
    ** generic array
    */
    if (Array.isArray(v))
      return `[${k}] [${v.join(", ")}]`;
  
    /*
    ** plain object
    */
    if (typeof v === "object")
      return `[${k}] ${JSON.stringify(v)}`;
  
    return `[${k}] [unserializable]`;
}


/*
** summarize the segment
*/
export async function summariseSegment(opts: {
    query: string;
    segmentHistory: Record<string, unknown>;
    model: string;
}): Promise<{summary: string, next_query: string}> {
    const flat = Object.entries(opts.segmentHistory)
                     .map(([k, v]) => serializeResult(k, v))
                     .join("\n") || "[no new data]";

  
    const prompt = `
You are an orchestrator agent.

* Overall goal so far: "${opts.query}"
* Newly gathered data:
${flat}

Call **summarize_segment** exactly once with:
• "summary"    - 1-2 sentences
• "next_query" - the rewritten goal for the next site, or leave empty "" if no change.
`;  
    console.log("prompt", prompt);
    const config = {
      temperature: 0.2,
      maxOutputTokens: 70000,
      tools: [{ functionDeclarations: SummarizeSegmentDeclaration }]
    };
  
    const resp = await callLLM({
      provider: 'gemini',
      tier: 'light',
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
      ignoreFnCallCheck: true
    });

    const fn = getFnCall(resp);
    return fn?.args as { summary: string, next_query: string } ?? { summary: "", next_query: "" };
}

/*
** serialize the results for synthesis
*/
export function toText(val: unknown): string {
    if (val == null) return "";

    /*
    ** single string
    */
    if (typeof val === "string") return val.trim();

    /*
    ** array of primitives or objects
    */
    if (Array.isArray(val)) {
        return val
        .map(item => `• ${toText(item)}`)        // recurse for each item
        .join("\n");
    }

    /*
    ** plain object → "key: value, key2: value2"
    */
    if (typeof val === "object") {
        return Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${toText(v)}`)
        .join(", ");
  }

    /*
    ** numbers / booleans etc.
    */
    return String(val);
}

  