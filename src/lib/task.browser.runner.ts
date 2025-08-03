import { SkillStep } from "./task.browser.schemas";
import { runAtomicStep } from "./task.browser.runner.atomic";
import { Browser, Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";

interface Runner {
  (
    step: SkillStep, 
    ctx: { 
      browser: Browser, 
      page: Page, 
      params: Record<string, unknown> 
    }): Promise<unknown>;
}

export const StepRunnerRegistry: Record<SkillStep["action"], Runner> = {
  /*
  ** handle click
  */
  click: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle type
  */
  type: async (step, { page, params }) => {
    const text = params[step.input_key as string] as string;
    return runAtomicStep({ step, page, params: { text } });
  },

  /*
  ** handle press enter
  */
  press_enter: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle wait for selector
  */
  wait_for_selector: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle extract list
  */
  extract_list: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle extract fields
  */
  extract_fields: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle navigate back
  */
  navigate_back: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle click element by index
  */
  click_element_by_index: async (step, { page, params }) => runAtomicStep({ step, page, params }),
  /*
  ** navigate to url
  */
  navigate_to_url: async (step, { page, params }) => runAtomicStep({ step, page, params }),

  /*
  ** handle scroll down
  */
  scroll_down: async (step, { page, params }) => runAtomicStep({ step, page, params }),
};

/**
 * Provides semantic descriptions for browser actions
 * @param action - The action type to get description for
 * @returns A human-readable description of what the action does
 */
export function actionDesc(action: SkillStep["action"]): string {
  const descriptions: Record<SkillStep["action"], string> = {
    click: "Clicks on a specific element identified by a CSS selector",
    type: "Types text into an input field or text area using a CSS selector",
    press_enter: "Simulates pressing the Enter key on the currently focused element",
    wait_for_selector: "Waits for an element to appear on the page before proceeding",
    extract_list: "Extracts a list of text content or data from multiple elements matching a selector",
    extract_fields: "Extracts field data (like form values) from elements matching a selector",
    navigate_back: "Navigates back to the previous page in the browser history",
    click_element_by_index: "Clicks on a specific element from a list of elements, identified by index position",
    navigate_to_url: "Navigates to a specific URL",
    scroll_down: "Scrolls down the page"
  };

  return descriptions[action] || `Unknown action: ${action}`;
}

/**
 * Gets all available actions with their descriptions
 * @returns An object mapping action names to their descriptions
 */
export function getAllActionDescriptions(): Record<SkillStep["action"], string> {
  const actions: SkillStep["action"][] = [
    "click",
    "type", 
    "press_enter",
    "wait_for_selector",
    "extract_list",
    "extract_fields",
    "navigate_back",
    "click_element_by_index",
    "navigate_to_url",
    "scroll_down"
  ];

  return actions.reduce((acc, action) => {
    acc[action] = actionDesc(action);
    return acc;
  }, {} as Record<SkillStep["action"], string>);
}