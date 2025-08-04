import { callLLM } from "./llm.engine";
import { 
    QueryAnalysisDeclaration, 
    SmallTalkDeclaration,
    BrowserActionDeclaration
} from "./query.tools";
import { getFnCall } from "./task.execution.helpers";
import { QUERY_FEW_SHOT } from "./query.fewshot";
import { SplitQueryResponse } from "./query.schemas";


export async function splitQuery({query, history, runtimeMode}: {query: string, history: any[], runtimeMode: string}): Promise<SplitQueryResponse> {
    const analysisDate = new Date().toISOString().split('T')[0];
    const prompt_general = `
${history ? `### CONVERSATION HISTORY\n${history}` : ''}
User: "${query}"

### TOOL SELECTION GUIDE
Choose the appropriate tool based on the user's query:

**Use 'small_talk_response' when:**
- User is making polite conversation, asking for jokes, or requesting simple factual information
- The query can be answered directly without information gathering or web research or browser action
- Examples: "Hello", "What is the capital of France?", "Tell me a joke", "How are you?"

**Use 'browser_action' when:**
- User wants to perform actions on a web page or website
- Request involves interacting with web elements (clicking, typing, searching, booking, etc.)
- Examples: "Book a flight to Paris", "Search for hotels in Tokyo", "Find jobs on LinkedIn", "Fill out this form", "Ask a question about a page"

**Use 'analyze_query_strategy' when:** 
- To break the query into SEQUENTIAL sub-queries. 
- Independent information-gathering steps must be placed *earlier* in the list so later steps can reference their answers.
- User needs information that requires research or multi-step analysis
- Query requires breaking down into sequential sub-tasks
- Request involves gathering information from multiple sources
- Examples: "Compare prices between different airlines", "Research the history of AI development", "Find the best restaurants in multiple cities"

### ADDITIONAL GUIDANCE FOR 'analyze_query_strategy'
- Produce the minimal number of sub-queries necessary to answer the user's query.
- Use concise keywords whenever possible; avoid long, verbose sub-query sentences or questions.
- Take the conversation history into account: do not repeat questions for information already provided, 
  and resolve pronouns or ellipses using the context. If the user requests information about multiple 
  elements or entities, split the query into separate sub-queries for each entity, rather than searching for all at once.
- Specify "dependencies" so that each subsequent sub-query lists the indices of the queries it depends on.
  If a step is logically independent but you still want to enforce strict execution order, include the index of the previous step in "depends_on".
- For independent steps, list the index of the previous step in "depends_on" to maintain order.

${QUERY_FEW_SHOT}

Date: ${analysisDate}
(Please use this date for accurate search results)
`;

const prompt_research = `
${history ? `### CONVERSATION HISTORY\n${history}` : ''}
User: "${query}"

### TOOL SELECTION GUIDE
Choose the appropriate tool based on the user's query:

**Use 'small_talk_response' when:**
- User is making polite conversation, asking for jokes, or requesting simple factual information
- The query can be answered directly without information gathering or web research or browser action
- Examples: "Hello", "What is the capital of France?", "Tell me a joke", "How are you?"

**Use 'analyze_query_strategy' when:** 
- To break the query into SEQUENTIAL sub-queries. 
- Independent information-gathering steps must be placed *earlier* in the list so later steps can reference their answers.
- User needs information that requires research or multi-step analysis
- Query requires breaking down into sequential sub-tasks
- Request involves gathering information from multiple sources
- Examples: "Compare prices between different airlines", "Research the history of AI development", "Find the best restaurants in multiple cities"

### ADDITIONAL GUIDANCE FOR 'analyze_query_strategy'
- Produce the minimal number of sub-queries necessary to answer the user's query.
- Use concise keywords whenever possible; avoid long, verbose sub-query sentences or questions.
- Take the conversation history into account: do not repeat questions for information already provided, 
  and resolve pronouns or ellipses using the context. If the user requests information about multiple 
  elements or entities, split the query into separate sub-queries for each entity, rather than searching for all at once.
- Specify "dependencies" so that each subsequent sub-query lists the indices of the queries it depends on.
  If a step is logically independent but you still want to enforce strict execution order, include the index of the previous step in "depends_on".
- For independent steps, list the index of the previous step in "depends_on" to maintain order.

${QUERY_FEW_SHOT}

Date: ${analysisDate}
(Please use this date for accurate search results)
`;

    const prompt_browser_action = `
${history ? `### CONVERSATION HISTORY\n${history}` : ''}
User: "${query}"

### TOOL SELECTION GUIDE
Choose the appropriate tool based on the user's query. But most of the time, use the 'browser_action' tool, because user could ask
to find information in a non-chatty way.

**Use 'small_talk_response' when:**
- User is making polite conversation, asking for jokes, or requesting simple factual information
- The query can be answered directly without information gathering or web research or browser action
- Examples: "Hello", "What is the capital of France?", "Tell me a joke", "How are you?"

**Use 'browser_action' when:**
- User wants to perform actions on a web page or website
- Request involves interacting with web elements (clicking, typing, searching, booking, etc.)
- Examples: "Book a flight to Paris", "Search for hotels in Tokyo", "Find jobs on LinkedIn", "Fill out this form", "Ask a question about a page"
  or searching from information in personal page of the user like slack, linkedin, notion, gmail, etc.

Date: ${analysisDate}

`;

    const MODE = runtimeMode; // research or general or action
    const SYSTEM_CONFIG = {
        action: {
            prompt: prompt_browser_action,
            tools: [
                SmallTalkDeclaration, 
                BrowserActionDeclaration
            ]
        },
        research: {
            prompt: prompt_research,
            tools: [
                QueryAnalysisDeclaration, 
                SmallTalkDeclaration
            ]
        },
        general: { // we will use this later
            prompt: prompt_general,
            tools: [
                QueryAnalysisDeclaration, 
                SmallTalkDeclaration, 
                BrowserActionDeclaration
            ]
        }
    }
    
    // tool declaration based on the mode choses
    const TOOLS = SYSTEM_CONFIG[MODE].tools;
    
    /*
    ** config setup
    */
    const config = {
        temperature: 0.0,
        maxOutputTokens: 10096,
        mode: 'ANY',
        tools: [{ 
            functionDeclarations: [
                ...TOOLS
            ] 
        }]
    }
    /*
    ** call LLM
    */
    const response = await callLLM({
        modelId: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: SYSTEM_CONFIG[MODE].prompt }] }],
        config,
        ignoreFnCallCheck: true
    });

    /*
    ** get function call data
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

    if (call?.name === "browser_action") {
        return {
            kind: "browser_action",
            steps: call?.args?.steps ?? []
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
