import { v4 as uuidv4 } from 'uuid';

import { 
    BrowserStepBreakdownDeclaration,
    BrowserPlanRefineDeclaration,
    BrowserMacroRepairDeclaration,
    BrowserMicroRepairDeclaration,
    EvaluateMacroTool
 } from './task.browser.tools';
import { callLLM } from '../llm.engine';
import { getFnCall } from '../task.execution.helpers';
import { stepTranslator } from '../plan.orchestrator';
import { handlePuppeteerAction } from '../pptr';
import { emit, pushHistory, truncate } from "../task.execution.helpers"
import { DomService } from '../dom';
import { EvaluateMacroArgs } from './task.browser.schemas';

/*
** generate a macro browsing plan from a high-level goal
*/
export async function generateMicroSteps({ sentence, pageURL }: { sentence: string, pageURL: string }) {
  const prompt = `You translate a single *macro* instruction into low-level browser actions.
Allowed low-level action on the browser are:
- go to a url
- click on an element by index
- input text into an element by index
- send keys to an element by index:
  • Form navigation: Enter, Tab, Shift+Tab, Escape
  • Text editing: ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Backspace, Delete, Home, End
  • Page navigation: Space, PageUp, PageDown
  • Common shortcuts: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z, Cmd+A, Cmd+C, Cmd+V, Cmd+Z
- scroll up
- scroll down
- wait for a selector to be visible
- get the visible text of an element by index
- get the current page structure to extract interactive elements
- go back
- go forward
- refresh the page
- mark the end of a macro step

# Notes
Return the minimal ordered list of micro-steps needed to fulfill the goal.

# Examples

Example 1:
MACRO: "Go to Youtube home page"
PAGE: "about:blank"
OUT:
- go to https://www.youtube.com/
- wait for the page to load
- finish the macro step

Example 2:
MACRO: "Search for 'Elon Musk' and sort result by upload date"
PAGE: "https://www.youtube.com/"
OUT:
- get the current page structure to extract interactive elements
- locate the search input by index
- input "Elon Musk" into the search input by index
- click the search button by index or send keys Enter to submit the search
- wait for the search results to load
- sort the search results by upload date
- finish the macro step


# Context
Current page: ${truncate(pageURL, 200)}
Macro goal: "${sentence}"

Note: 
- Do not use the name of tools, but always use the action like for referencing go_to_url could be navigate to.
- If you have already input text for example "Elon Musk" into an input field, do not send keys "Elon Musk" again, but use the action to send keys Enter to submit the search.
`;
  
    const resp = await callLLM({
        modelId: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            temperature: 0,
            maxOutputTokens: 2048,
            mode:  "ANY",
            tools: [{ functionDeclarations: [BrowserStepBreakdownDeclaration] }]
        },
        ignoreFnCallCheck: true
    });
  
    const fc = getFnCall(resp);
    return fc?.args?.micro_steps ?? [sentence];
}

/*
** refine entire macro plan
*/
export async function refineMacroPlan(
    {originalSteps, userQuery}: 
    {originalSteps: string[], userQuery: string}
) {
    const prompt = `You are a task-planner for a browser automation agent.

# Goal
Rewrite the agent's high-level steps so they are:
- strictly sequential
- actionable (no vague wording)
- minimal (no redundant work)

# Examples
Example 1:
User query: "Book the cheapest flight from NYC to Toronto for the next Friday"
ORIGINAL STEPS:
- open booking site
- search flight
- pick cheapest
- checkout
CORRECTED STEPS:
- Navigate to online flight aggregator
- Type "NYC -> Toronto" in the search input in departure field and arrival field respectively
- Sort by price ascending
- open the details page of the top-priced flight
- proceed to checkout until the payment page is displayed (do NOT pay)

Example 2:
User query: "Find elon musk's latest popular video and read angry comments"
ORIGINAL STEPS:
- open youtube
- search elon musk
- pick the most popular video
- read comments
CORRECTED STEPS:
- Navigate to youtube home page
- Type "elon musk" in the search input
- Sort result by upload date
- Open the first video that has the most views (100 k+ views)
- Scroll to the comments section and collect the 50 newest comments
- Filter comments with negative or angry sentiment and summarise them

# Context
User query: "${userQuery}"
ORIGINAL STEPS:
${originalSteps.map((s) => `- ${s}`).join("\n")}

# Return
Return the minimal ordered list of micro-steps needed to fulfil the goal.
Improve it if needed (order, clarity, remove useless steps, add missing steps).
And be very flexible with steps for browser automation. Avoid producing few steps, it should be atomic.
`;
    const resp = await callLLM({
        modelId: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            temperature: 0,
            maxOutputTokens: 1024,
            mode: "ANY",
            tools: [{ functionDeclarations: [BrowserPlanRefineDeclaration] }]
        },
        ignoreFnCallCheck: true
    });
    const fc = getFnCall(resp);
    return fc?.args?.corrected_steps ?? originalSteps;
}

/*
** repair one failing macro step
*/
export async function repairMacroStep(
    {failingStep, lastError, pageURL}:
    {failingStep: string, lastError: string, pageURL: string}
) {
    const prompt = `You are a recovery agent. Propose ONE alternative macro step that could achieve the same high-level goal, given the page context and last error.

# Examples
Example 1:
FAILING_MACRO: "Open the cheapest flight details page"
PAGE_URL: "https://www.skyscanner.com/..." <- the page URL
ERROR: "Selector .price-row not found" <- the last error
RECOVERY: "Open the first search-result row that shows a price tag" <- the recovery

### CONTEXT
FAILING_MACRO: "${failingStep}"
PAGE_URL: ${pageURL}
ERROR: "${lastError}"

### RECOVERY
`;
    const resp = await callLLM({
        modelId: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            temperature: 0,
            maxOutputTokens: 256,
            mode: "ANY",
            tools: [{ functionDeclarations: [BrowserMacroRepairDeclaration] }]
        },
        ignoreFnCallCheck: true
    });
    const fc = getFnCall(resp);
    return fc?.args?.recovery ?? failingStep;
}

/*
** repair one failing micro-step
*/
export async function repairMicroStep(
    {failing, lastError, pageURL}:
    {failing: string, lastError: string, pageURL: string}
  ) {
    const prompt = `
You are a recovery agent. Suggest a single replacement low-level action for the failed step,
using the same tool grammar as before. Base your fix on the error below.

# Context
FAILING_MICRO: "${failing}"
PAGE_URL: ${pageURL}
ERROR: "${lastError}"

# Return
Return the recovery as a single low-level action.

# Examples
Example 1:
FAILING_MICRO: "Click on the button add to cart"
PAGE_URL: "https://www.amazon.com/..."
ERROR: "Timeout 5000ms"
RECOVERY: "Click on input with the value add to cart"
`;
    const resp = await callLLM({
      modelId: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0,
        maxOutputTokens: 256,
        mode: "ANY",
        tools: [{ functionDeclarations: [BrowserMicroRepairDeclaration] }]
      },
      ignoreFnCallCheck: true
    });
    const fc = getFnCall(resp);
    return fc?.args?.recovery ?? failing;
}

/*
** execute one micro-step
*/
export async function executeMicroStep(
    {sentence, taskId, page, browser, history}:
    {sentence: string, taskId: string, page: any, browser: any, history: any[]}
  ) {
    /* translate sentence → low-level toolCall (e.g. go_to_url, click) */
    // ctx is the structure of the page
    const domService = new DomService(page);
    const ctx = await domService.getInteractiveElements();
    const toolCall = await stepTranslator(sentence, history, ctx);

    console.log("translated micro-step", sentence, toolCall);
    const actionId = uuidv4();
  
    emit("task_action_start", {
      taskId,
      action: toolCall?.name,
      speakToUser:  sentence,
      status: "running",
      actionId,
      url: page.url()
    });
  
    /* run once ------------------------------------------------------- */
    const res = await handlePuppeteerAction({
      actionDetails: {
        action: toolCall.name,
        parameters: toolCall.args,
        taskId
      },
      currentPage: page,
      browserInstance: browser
    });
    console.log("executed micro-step", sentence, res);
  
    emit("task_action_complete", {
      taskId,
      action: toolCall?.name,
      speakToUser: sentence,
      status: res.success ? "success" : "failed",
      error: res.success ? undefined : res.error,
      actionId
    });
  
    /* context trimming ------------------------------------------------*/
    pushHistory(history, toolCall.name, toolCall.args, res.data);
    if (history.length > 20) history.splice(0, history.length - 20);
  
    return {
      success: res.success,
      error: res.error,
      toolCall: toolCall?.name,
      data: res.data,
      ctx
    }
}


const MACRO_EVAL_FEW_SHOT = `
### EXAMPLE 1
User Query:     "Add a USB-C cable with at least 4★ reviews to my Amazon cart"
Macro Step:     "Navigate to Amazon homepage"
Current URL:    "https://www.amazon.com/"
Outcome:        Success
Assistant:
<evaluate_macro {"complete": true, "feedback": ""}>

### EXAMPLE 2
User Query:     "Play the newest MrBeast video on YouTube"
Macro Step:     "Click the first video result"
Current URL:    "https://www.youtube.com/results?search_query=MrBeast"
Outcome:        Click failed - element not found
Assistant:
<evaluate_macro {"complete": false, "feedback": "Could not locate the first video result (element not visible)."}>
`;

/*
** eval engine for macro
*/
export async function evaluateMacro (
  { macroStep, pageURL, ctx }: EvaluateMacroArgs
): Promise<{ complete: boolean; feedback: string }> {

  const prompt = `You are a helpful assistant that evaluates the success of a macro step.
Given a macro step and the current page URL are provided, you evaluate the macro step completeness based on the current page URL and page content;

${MACRO_EVAL_FEW_SHOT}

Macro Step:  "${macroStep}"
Current URL: "${pageURL}"
Page Context:
${JSON.stringify(ctx, null, 2)}

Respond ONLY with an evaluate_macro function call.
`;

  const resp = await callLLM({
    modelId : 'gemini-2.5-flash',
    contents: [{ role:'user', parts:[{ text: prompt }] }],
    config  : {
      temperature     : 0.0,
      maxOutputTokens : 1024,
      mode            : 'ANY',
      tools           : [{ functionDeclarations: [EvaluateMacroTool] }]
    },
    ignoreFnCallCheck: true
  });

  const fn = getFnCall(resp);
  const out = fn?.args ?? { complete:false, feedback:'unknown error' };
  return { complete: out.complete, feedback: out.feedback };
}