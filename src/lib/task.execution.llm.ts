import { SynthesisDeclaration } from "./task.execution.tools";
import { getFnCall } from "./task.execution.helpers";
import { callLLM } from "./llm.engine";

export async function synthesizeResults(originalQuery: string, results: (string | undefined)[], model: string = 'gemini-2.5-flash') {
  const synthesisPrompt = `
You are Runtime-Agent. Combine the answers of each sub-query into a single,
well-structured response for the original question.

Original question: "${originalQuery}"

Sub-Query Answers:
${results
  .map((r, i) => `  • SQ${i}: ${r ?? "[no answer]"}`)
  .join("\n")}

Return one synthesize_results tool call.

Important: Please format your response using markdown. Whenever possible, present information in bullet points for clarity and readability.
`;

  const synthResp = await callLLM({
    modelId: model,
    contents: [{ role: "user", parts: [{ text: synthesisPrompt }] }],
    config: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      mode: "ANY",
      tools: [{ functionDeclarations: [SynthesisDeclaration] }]
    }, 
    ignoreFnCallCheck: true
  });
  console.log("synthResp", synthResp);
  const synthFn = getFnCall(synthResp);
  const finalAnswer =
    synthFn?.args?.synthesized_answer ||
    synthFn?.args?.summary ||
    "Unable to synthesise.";

  return finalAnswer;
}