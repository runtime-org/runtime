import { 
  SynthesisDeclaration, 
  SynthesisDeclarationBrowsing 
} from "./task.execution.tools";
import { getFnCall } from "./task.execution.helpers";
import { callLLM } from "./llm.engine";

/*
** synthesize the results for research task
*/
export async function synthesizeResults(originalQuery: string, results: (string | undefined)[], model: string = 'gemini-2.5-flash') {
  const synthesisPrompt = `
You are Runtime-Agent. Combine the answers of each sub-query into a well-structured response for the original question.

Original question: "${originalQuery}"

Sub-Query Answers:
${results
  .map((r, i) => `  • SQ${i}: ${r ?? "[no answer]"}`)
  .join("\n")}

Return one synthesize_results tool call.

Important:
- Please format your response using markdown formatting (for example, use '#' for headings, '**word**' for bold, and ' *' for bullet points).
- Always use bullet points to enhance clarity and readability, unless the answer consists of a single sentence. Avoid presenting answers as a block of sentences; instead, use bullet points for better organization.
  But always start with a sentence.
- Limit each paragraph to a maximum of two sentences, but always prefer to use bullet points to enhance clarity and readability.
- Do not mention any tools unless they are directly relevant to the user's question.
- If there is missing information or a knowledge gap, provide the best possible answer based on the information available.
`;

  console.log("synthesisPrompt", synthesisPrompt);

  let synthFn: any = null;
  let attempt = 0;
  const maxTries = 2;

  while (attempt < maxTries && !synthFn?.args?.synthesized_answer) {
    attempt++;
    console.log(`Synthesis attempt ${attempt}/${maxTries}`);

    const synthResp = await callLLM({
      modelId: model,
      contents: [{ role: "user", parts: [{ text: synthesisPrompt }] }],
      stream: true,
      config: {
        temperature: attempt === 1 ? 0.2 : 0.3,
        maxOutputTokens: 8192,
        mode: "ANY",
        tools: [{ functionDeclarations: SynthesisDeclaration }]
      }, 
      ignoreFnCallCheck: true
    });

    synthFn = getFnCall(synthResp);
    console.log("synthFn", synthFn);

  }

  const finalAnswer =
    synthFn?.args?.synthesized_answer ||
    synthFn?.args?.summary ||
    "Unable to synthesise.";

  return finalAnswer;
}

/*
** synthesize the results for browsing task
*/
export async function synthesizeResultsBrowsing(originalQuery: string, results: (string | undefined)[], model: string = 'gemini-2.5-flash') {
  const synthesisPrompt = `
You are Runtime-Agent. Combine the answers of each sub-query into a well-structured response for the original question.
Please give factual information that you find in the results.

Original question: "${originalQuery}"

Sub-Query Browsing Results:
${results
  .map((r, i) => `  • SQ${i}: ${r ?? "[no answer]"}`)
  .join("\n")}

Return one synthesize_results_browsing tool call.

Important:
- Avoid saying I I cannot directly access or read your personal, etc. But be an helpful assistant. Avoid explaining you 
  incapabilities like "Based on the provided browsing results, I cannot directly read your personal Twitter feed. The information I have access to consists of a collection of public tweets from various users, not a tool to access individual user feeds."
- Please format your response using markdown formatting (for example, use '#' for headings, '**word**' for bold, and ' *' for bullet points).
- Always use bullet points to enhance clarity and readability, unless the answer consists of a single sentence. Avoid presenting answers as a block of sentences; instead, use bullet points for better organization.
  But always start with a sentence.
- Limit each paragraph to a maximum of two sentences, but always prefer to use bullet points to enhance clarity and readability.
- Do not mention any tools unless they are directly relevant to the user's question.
- If there is missing information or a knowledge gap, provide the best possible answer based on the information available.
`;

  console.log("synthesisPrompt", synthesisPrompt);

  let synthFn: any = null;
  let attempt = 0;
  const maxTries = 2;

  while (attempt < maxTries && !synthFn?.args?.synthesized_answer) {
    attempt++;
    console.log(`Synthesis attempt ${attempt}/${maxTries}`);

    const synthResp = await callLLM({
      modelId: model,
      contents: [{ role: "user", parts: [{ text: synthesisPrompt }] }],
      stream: true,
      config: {
        temperature: attempt === 1 ? 0.2 : 0.3,
        maxOutputTokens: 8192,
        mode: "ANY",
        tools: [{ functionDeclarations: SynthesisDeclarationBrowsing }]
      }, 
      ignoreFnCallCheck: true
    });

    synthFn = getFnCall(synthResp);
    console.log("synthFn", synthFn);

  }

  const finalAnswer =
    synthFn?.args?.synthesized_answer ||
    synthFn?.args?.summary ||
    "Unable to synthesise.";

  return finalAnswer;
}