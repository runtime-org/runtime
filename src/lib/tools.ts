// lib/tools.js
import { Type } from '@google/genai';

export const ActionDeclarations = [
  // ===== TASK COMPLETION =====
  {
    name: 'done',
    description: "Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached" +
    "Give the final result of the task in a constructive sentence.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        success: {
          type: Type.BOOLEAN,
          description: 'Whether the task was completed successfully'
        },
        text: {
          type: Type.STRING,
          description: 'Description of what was accomplished or final result'
        }
      },
      required: ['success', 'text']
    }
  },

  // ===== NAVIGATION ACTIONS =====
  {
    name: 'search_google',
    description: 'Search the query in Google, the query should be in keywords, concrete and not vague or super long.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'The search query to look for in Google'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'go_to_url',
    description: 'Navigate to URL in the current tab',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The URL to navigate to'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'go_back',
    description: 'Go back in browser history',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'go_forward',
    description: 'Go forward in browser history',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'refresh_page',
    description: 'Refresh/reload the current page',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },

  // ===== TIMING/WAITING =====
  {
    name: 'wait',
    description: 'Wait for x seconds default 3',
    parameters: {
      type: Type.OBJECT,
      properties: {
        seconds: {
          type: Type.NUMBER,
          description: 'Number of seconds to wait (default: 3)'
        }
      }
    }
  },

  // ===== ELEMENT INTERACTION =====
  {
    name: 'click_element_by_index',
    description: 'Click element by index from the page context',
    parameters: {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
          description: 'The index number of the element to click'
        }
      },
      required: ['index']
    }
  },
  {
    name: 'input_text',
    description: 'Input text into a input interactive element by index',
    parameters: {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
          description: 'The index number of the input element'
        },
        text: {
          type: Type.STRING,
          description: 'The text to input into the element'
        }
      },
      required: ['index', 'text']
    }
  },
  // ===== SCROLLING =====
  {
    name: 'scroll_down',
    description: 'Scroll down the page by pixel amount - if none is given, scroll one page',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.NUMBER,
          description: 'Number of pixels to scroll down (optional, defaults to one page height)'
        }
      }
    }
  },
  {
    name: 'scroll_up',
    description: 'Scroll up the page by pixel amount - if none is given, scroll one page',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.NUMBER,
          description: 'Number of pixels to scroll up (optional, defaults to one page height)'
        }
      }
    }
  },
  {
    name: 'scroll_to_text',
    description: 'If you dont find something which you want to interact with, scroll to it by searching for text content',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: 'The text content to scroll to'
        }
      },
      required: ['text']
    }
  },

  // ===== PAGE STATE/CONTEXT =====
  {
    name: 'get_simplified_page_context',
    description: 'Get a comprehensive overview of the current page with interactive elements, accessibility tree, and optional screenshot',
    parameters: {
      type: Type.OBJECT,
      properties: {
        include_screenshot: {
          type: Type.BOOLEAN,
          description: 'Whether to include a base64 screenshot (default: true)'
        },
        max_elements: {
          type: Type.NUMBER,
          description: 'Maximum number of interactive elements to return (default: 100)'
        }
      }
    }
  },
  {
    name: "get_visible_text",
    description: "Get the visible text of the current page",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },

  // ===== RUNTIME CONTROL =====
  {
    name: 'ask_user',
    description: 'Ask the user a question when clarification is needed',
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: {
          type: Type.STRING,
          description: 'The question to ask the user'
        }
      },
      required: ['question']
    }
  },
  {
    name: "small_talk",
    description: "Engage in natural conversation with users regarding non-automation topics, maintaining a professional assistant demeanor while providing concise explanations of actions taken",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
];


export const AvailableActions = [
  "done",
  "search_google", 
  "go_to_url",
  "go_back",
  "go_forward",
  "refresh_page",
  "wait",
  "click_element_by_index",
  "input_text",
  "scroll_down",
  "scroll_up", 
  "scroll_to_text",
  "get_simplified_page_context",
  "get_visible_text",
  "ask_user",
  "small_talk",
]

