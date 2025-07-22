import { callLLM } from "./llm.engine";
import { QueryAnalysisDeclaration } from "./tools";
import { getFnCall } from "./task.execution.helpers";
import { QUERY_FEW_SHOT } from "./query.fewshot";
import { SplitQueryResponse } from "./query.schemas";


export async function splitQuery({query, history}: {query: string, history: any[]}): Promise<SplitQueryResponse> {
    const analysisDate = new Date().toISOString().split('T')[0];
    const prompt = `
${history ? `### CONVERSATION HISTORY\n${history}` : ''}
User-Query: "${query}"

Goal: Always use the tool 'analyze_query_strategy' to break the query into
SEQUENTIAL sub-queries. Independent information-gathering steps must be placed
*earlier* in the list so later steps can reference their answers.

### ADDITIONAL GUIDANCE
- Produce the MINIMAL number of sub-queries needed.
- Please use as you can keywords, avoid long sub-queries.
- Take the conversation history into account; avoid re-asking for facts that 
  already appear there, and resolve pronouns/ellipsis using it.
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
        tools: [{ functionDeclarations: QueryAnalysisDeclaration }]
    }
    /*
    ** call LLM
    */
    const response = await callLLM({
        modelId: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config,
        ignoreFnCallCheck: true
    });

    /*
    ** get function call
    */
    const call = getFnCall(response);
    if (!call) return { queries: [query], dependencies: [], researchFlags: [] };

    const resp = {
        queries: call?.args?.queries ?? [query],
        dependencies: call?.args?.dependencies ?? [],
        researchFlags: call?.args?.researchFlags ?? []
    }
    return resp;
}
