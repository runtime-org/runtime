import { callLLM } from "./llm.engine";
import { QueryAnalysisDeclaration, SmallTalkDeclaration } from "./tools";
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
- Produce the minimal number of sub-queries necessary to answer the user's query.
- Use concise keywords whenever possible; avoid long, verbose sub-query sentences or questions.
- Take the conversation history into account: do not repeat questions for information already provided, and resolve pronouns or ellipses using the context. If the user requests information about multiple elements or entities, split the query into separate sub-queries for each entity, rather than searching for all at once.
- Specify "dependencies" so that each subsequent sub-query lists the indices of the queries it depends on.
  If a step is logically independent but you still want to enforce strict execution order, include the index of the previous step in "depends_on".
- For independent steps, list the index of the previous step in "depends_on" to maintain order.

${QUERY_FEW_SHOT}

Date: ${analysisDate}
(Please use this date for accurate search results)
`;

    /*
    ** config setup
    */
    const config = {
        temperature: 0.0,
        maxOutputTokens: 10096,
        mode: 'ANY',
        tools: [{ functionDeclarations: [QueryAnalysisDeclaration, SmallTalkDeclaration] }]
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
    if (!call) return { 
        queries: [query], 
        kind: "analysis",
        dependencies: [], 
        researchFlags: [] 
    };

    if (call?.name === "small_talk_response") {
        return {
            kind: "small_talk",
            reply: call?.args?.reply ?? ""
        }
    }

    const resp = {
        kind: "analysis",
        queries: call?.args?.queries ?? [query],
        dependencies: call?.args?.dependencies ?? [],
        researchFlags: call?.args?.researchFlags ?? []
    }
    return resp;
}
