import { Type } from "@google/genai";

export const BrowserStepBreakdownDeclaration = {
    name: "browser_action_breakdown",
    description: `
  Decompose ONE high-level browsing goal into an ordered list of granular
  page-interaction steps.  
  Allowed verbs: go_to_url, click, search_google, go_back, go_forward, refresh_page, 
  input_text, scroll_up, scroll_down, wait_for_selector, wait, get_visible_text, 
  get_simplified_page_context, done, click_element_by_index, send_keys, scroll_to_text`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        micro_steps: {
          type: Type.ARRAY,
          description: "Concrete UI actions in execution order.",
          items: { type: Type.STRING }
        }
      },
      required: ["micro_steps"]
    }
};

/*
** refine the whole macro plan
*/
export const BrowserPlanRefineDeclaration = {
  name: "browser_plan_refine",
  description: `Review and improve a list of high-level browsing steps so
they are minimal, ordered and unambiguous to achieve the high-level goal.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      corrected_steps: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
    required: ["corrected_steps"]
  }
};

/*
** repair one failing macro step
*/
export const BrowserMacroRepairDeclaration = {
  name: "browser_macro_repair",
  description:
    `Given a failing macro step, the error message and current page URL,
return ONE replacement macro step that is likely to succeed.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      recovery: { type: Type.STRING }
    },
    required: ["recovery"]
  }
};

/*
** repair one failing micro-step
*/
export const BrowserMicroRepairDeclaration = {
  name: "browser_micro_repair",
  description: `Given ONE failing micro instruction, the error message and the
current page URL, return ONE alternative micro instruction that is likely to
succeed. Keep it short and actionable.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      recovery: { type: Type.STRING }
    },
    required: ["recovery"]
  }
};

/*
** eval macro tool
*/
export const EvaluateMacroTool = {
  name : 'evaluate_macro',
  description: `Judge if the most-recent macro step achieved the user's goal **given the current page state**. 
  Return complete=true only when the goal is fully satisfied. If not complete, give a short feedback sentence that explains what is still missing or what went wrong.`,
  parameters : {
    type       : Type.OBJECT,
    properties : {
      complete : { type: Type.BOOLEAN, description: 'Did the macro succeed?' },
      feedback : { type: Type.STRING,  description: 'Why not / what is missing?' }
    },
    required   : ['complete','feedback']
  }
};