import { callLLM } from "./llm.engine";
import { QueryAnalysisDeclaration } from "./tools";
import { getFnCall } from "./task.execution.helpers";
import { QUERY_FEW_SHOT } from "./query.fewshot";

export async function splitQuery(query) {
    const analysisDate = new Date().toISOString().split('T')[0];
    const prompt = `
User-Query: "${query}"

Goal: Always use the tool 'analyze_query_strategy' to break the query into
SEQUENTIAL sub-queries. Independent information-gathering steps must be placed
*earlier* in the list so later steps can reference their answers.

### ADDITIONAL GUIDANCE
- Produce the MINIMAL number of sub-queries needed.
- Specify "dependencies" so each later query lists the indices it relies on.
  If a step is logically independent but you still want strict execution
  order, list the index of the previous step in "depends_on".
- If a step is independent, list the index of the previous step in "depends_on".

${QUERY_FEW_SHOT}

Date: ${analysisDate}
(Please use this date for accurate search results)
`;

    /*
    ** config setup
    */
    const config = {
        temperature: 0.0,
        maxOutputTokens: 2048,
        mode: 'ANY',
        tools: [{ functionDeclarations: [QueryAnalysisDeclaration] }]
    }
    /*
    ** call LLM
    */
    const response = await callLLM({
        modelId: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config,
        isQuerySplitter: true
    });

    /*
    ** get function call
    */
    const call = getFnCall(response);
    if (!call) return [query];

    const resp = {
        queries: call?.args?.queries ?? [query],
        dependencies: call?.args?.dependencies ?? []
    }
    return resp;
}