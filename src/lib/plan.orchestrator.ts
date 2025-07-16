import { callLLM } from "./llm.engine";
import { getFnCall } from "./task.execution.helpers";
import { PLAN_FEW_SHOT } from "./plan.fewshot";
import { PlanDeclaration } from "./plan.tools";
import { ActionDeclarations } from "./tools";
import { PlanOrchestratorOptions } from "./plan.orchestrator.schemas";

/*
** produce a deterministic, ordored step list for ONE sub-query taking account of earlier answers.
*/
export async function planGenerator(opts: PlanOrchestratorOptions): Promise<string[]> {
    const { subQuery, queries, dependencies, results } = opts;

    /*
    ** build dynamic context for the prompt
    */
    const queriesBlock = queries.map((q, i) => { `   ${i}: ${q}` })
                                .join('\n');

    const resultsBlock = results.map((r, i) => { (r ? `   ${i}: ${r}` : `   ${i}: <pending>`); })
                                .join('\n');

    /*
    ** build the dependencies block
    */
    const depsBlock = dependencies.length
                    ? dependencies.map(d => `   ${d.query_index} depends on [${d.depends_on.join(",")}]`)
                                .join('\n')
                    : '   (none)';

    /*
    ** build the prompt
    */
    const prompt = `Generate an action plan for the following query: "${subQuery}".
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
    console.log("prompt", prompt);

    const config = {
        temperature: 0.0,
        maxOutputTokens: 1024,
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
export async function stepTranslator(step: string, history: string[]): Promise<Record<string, any>> {
    const prompt = `Translate the atomic web-browsing instruction below into the proper tool invocation.

Guidelines:
- choose the single tool that accomplishes the action, taking prior tool usage in this conversation into account.
- Output ONLY the call in the exact form of the tool invocation.
- Do not add any explanatory text.
- Always use tool 'done' to return the final answer to the sub-query.

Instruction:
${step}
`;
    const config = {
        temperature: 0.0,
        maxOutputTokens: 1000,
        mode: 'ANY',
        tools: [{ functionDeclarations: [ActionDeclarations] }]
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