import { callLLM } from "./llm.engine";
import { getFnCall, truncate } from "./task.execution.helpers";
import { PLAN_FEW_SHOT, EVAL_FEW_SHOT } from "./plan.fewshot";
import { 
    PlanDeclaration, 
    EvaluateAnswerTool, 
    SummaryDeclaration, 
} from "./plan.tools";
import { ActionDeclarations } from "./tools";
import { 
    PlanOrchestratorOptions, 
    EvaluateAnswerOptions, 
    EvaluateAnswerResponse 
} from "./plan.orchestrator.schemas";

/*
** produce a deterministic, ordored step list for ONE sub-query taking account of earlier answers.
*/
export async function planGenerator(opts: PlanOrchestratorOptions): Promise<string[]> {
    const { subQuery, queries, dependencies, results, feedback } = opts;
    /*
    ** build dynamic context for the prompt
    */
    const queriesBlock = queries.map((q, i) => `   ${i}: ${q}` )
                                .join('\n');

    const resultsBlock = results.map((r, i) => (r ? `   ${i}: ${r}` : `   ${i}: <pending>`))
                                .join('\n');

    /*
    ** build the dependencies block
    */
    const depsBlock = dependencies.length
                    ? dependencies.map(d => `   ${d.query_index} depends on [${d.depends_on.join(",")}]`)
                                .join('\n')
                    : '   (none)';

    const GUIDANCE = `
### PLANNING RULES
1. Replace vague phrases like "that date", "this value" with the concrete text from the Known Results.  
2. If a previous result already contains the answer, create one step: 
    "Use the stored answer from the result [i] and finish the task".
3. Otherwise the browsing pattern MUST be:
    - Google search ...
    - Retrieve the simplified page structure ...
    - Click a reliable link ...
    - Read visible text on the linked page ...
    - Return the answer
   Keep that order. Never skip "click" or "read".
4. Whenever you extract a key fact that later sub-queries might reuse, 
    add a step starting with "Store" describing what you saved.
5. Any question that ultimately asks "**when is …**", "**date of …**" or "**what's the date of …**"
    relative expressions like "next Monday", "this weekend", "Mother's Day" 
    MUST navigate to **https://days.to/** and read the visible text there.
    Use either:
     • go_to_url "https://days.to/when-is/<keyword>"
     • or Google search → click the first days.to link → read text.
`;

    /*
    ** build the prompt
    */
    let prompt = `
Generate an action plan for the following query: "${subQuery}".
${GUIDANCE}
${PLAN_FEW_SHOT}
# CURRENT CONTEXT
All Sub-Queries:
${queriesBlock}
Dependencies:
${depsBlock}
Known Results (index -> text):
${resultsBlock}
Plan for sub-query (index ${queries.indexOf(subQuery)}):
"${subQuery}"

Return ONLY a generate_action_plan tool call with the "steps" array.
    `;

    if (feedback) prompt += `\nEvaluator Feedback: ${feedback}\n`;

    const config = {
        temperature: 0.0,
        maxOutputTokens: 2048,
        mode: 'ANY',
        tools: [{ functionDeclarations: [PlanDeclaration] }]
    }
    const resp = await callLLM({ 
        modelId: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [ { text: prompt } ] }],
        config,
        ignoreFnCallCheck: true
    });

    const fn = getFnCall(resp);
    return fn?.args?.steps ?? [];
}

/*
** translate the atomic web-browsing instruction into the proper tool invocation.
*/
export async function stepTranslator(step: string, history: string[], ctx: any[]): Promise<Record<string, any>> {
    let prompt = `Translate the atomic web-browsing micro-step instruction below into the proper tool invocation.

You will be given a micro step instruction and you need to translate it into the proper tool invocation.

    Guidelines:
    - choose the single tool that accomplishes the action, taking prior tool usage in this conversation into account.
    - Output ONLY the call in the exact form of the tool invocation.
    - Do not add any explanatory text.
    - Do not ask any clarification question to the user.`;

    // Include page structure context if available
    if (ctx && ctx.length > 0) {
        prompt += `

    Current Page Structure:
    ${JSON.stringify(ctx, null, 2)}`;
    }

    prompt += `

    Instruction:
    ${step}
    `;

    const config = {
        temperature: 0.0,
        maxOutputTokens: 1000,
        mode: 'ANY',
        tools: [{ functionDeclarations: ActionDeclarations }]
    }

    const resp = await callLLM({ 
        modelId: "gemini-2.5-flash",
        contents: [
            { role: "user", parts: [ { text: prompt } ] },
            ...history
        ],
        config ,
        ignoreFnCallCheck: true
    });
    const fn = getFnCall(resp);
    return fn ?? {};
}

/*
** evaluate the answer
*/
export async function evalEngine(opts: EvaluateAnswerOptions): Promise<EvaluateAnswerResponse> {
    const { originalQuery, answer, subQuery } = opts;
    const prompt = `
${EVAL_FEW_SHOT}

Original User Query:
${originalQuery}
Sub-Query being evaluated:
${subQuery}
Proposed Answer:
${answer}

Respond ONLY with an evaluate_answer function call.
`;
    const resp = await callLLM({
        modelId: "gemini-2.5-flash",
        contents: [{ role:"user", parts:[{ text: prompt }] }],
        config: {
            temperature: 0.0,
            maxOutputTokens: 1024,
            mode: "ANY",
            tools:[{ functionDeclarations: [EvaluateAnswerTool] }]
        },
        ignoreFnCallCheck: true
    });
    const fn = getFnCall(resp);
    const constraintOutput = fn?.args ?? { complete: false, feedback: "unknown error" };
    return {
        complete: constraintOutput.complete,
        feedback: constraintOutput.feedback
    };
}

/*
** summarize a raw text from webpage into a concise summary
*/
export async function summarizeText({
    rawText, 
    query, 
    maxRetries = 7
}: {rawText: string, query?: string, maxRetries?: number}): Promise<{summary: string}> {
    const prompt = `You are a helpful assistant that summarizes text. Please use the "general_summarize_text" tool to summarize the text.
Raw visible text: ${truncate(rawText, 2000000)}
Sub-query: ${query}
Please summarize in bullet points.
`;
    
    const summaryCall = await callLLM({
        modelId: "gemini-2.5-flash-lite",
        contents: [{ role: "user", parts: [ { text: prompt } ] }],
        config: {
            temperature: 0.0,
            maxOutputTokens: 700000,
            mode: "ANY",
            tools: [{ functionDeclarations: [SummaryDeclaration] }]
        },
        ignoreFnCallCheck: true
    });

    const fn = getFnCall(summaryCall);
    console.log("fn", fn);
    console.log("summaryCall", summaryCall);

    /*
    ** normal check
    */
    if (fn?.args?.summary) {
        return {
            summary: fn.args.summary
        };
    }

    /*
    ** fallback check
    */
    const textContent = summaryCall?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textContent && textContent.trim()) {
        console.log("Using fallback text content for summary");
        return {
            summary: textContent.trim()
        };
    }

    /*
    ** retry or return fallback
    */
    const retry = maxRetries - 1;
    if (retry > 0) {
        console.log(`Summary extraction failed, retrying (${retry} attempts left)`);
        return await summarizeText({
            rawText: rawText,
            query: query,
            maxRetries: retry
        });
    }

    /*
    ** final fallback
    */
    return {
        summary: truncate(rawText, 1000)
    };
}