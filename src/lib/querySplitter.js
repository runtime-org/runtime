import { callLLM } from "./llm.engine";
import { QueryAnalysisDeclaration } from "./tools";
import { getFnCall } from "./task.execution.helpers";

export async function splitQuery(query) {
    /*
    ** config setup
    */
    const config = {
        temperature: 0.0,
        maxOutputTokens: 2048,
        mode: 'ANY',
        tools: [{ functionDeclarations: [QueryAnalysisDeclaration] }]
    }
    const analysisDate = new Date().toISOString().split('T')[0];
    const queryAnalysisPrompt = `Query: "${query}"
Date: ${analysisDate}

Goal: Always use the tool 'analyze_query_strategy' to analyze the query and return the queries.

If the query is complex, split it into parallel independent sub-queries. Otherwise, use a sequential query approach.
If you do not understand the query, return the original query as-is without requesting clarification from the user.
(Please use this date for accurate search results)
`;

    /*
    ** call LLM
    */
    const response = await callLLM({
        modelId: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: queryAnalysisPrompt }] }],
        config,
        isQuerySplitter: true
    });

    /*
    ** get function call
    */
    const call = getFnCall(response);
    if (!call) return [query];

    const { args, name } = call;

    /*
    ** return queries
    */
    if (name === 'analyze_query_strategy') {
        return args.queries;
    }

    return [query];
}