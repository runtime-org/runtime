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

  // ===== DROPDOWN INTERACTIONS =====
  {
    name: 'get_dropdown_options',
    description: 'Get all options from a native dropdown select element',
    parameters: {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
          description: 'The index number of the dropdown element'
        }
      },
      required: ['index']
    }
  },
  {
    name: 'select_dropdown_option',
    description: 'Select dropdown option for interactive element index by the text of the option you want to select',
    parameters: {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
          description: 'The index number of the dropdown element'
        },
        text: {
          type: Type.STRING,
          description: 'The exact text of the option to select'
        }
      },
      required: ['index', 'text']
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
          description: 'Maximum number of interactive elements to return (default: 50)'
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

export const QueryAnalysisDeclaration = [
  {
    name: 'analyze_query_strategy',
    description: 
        `Break the user query into an ordered SEQUENTIAL chain of sub-queries.
        Return each sub-query and an explicit dependencies list so the caller
        knows which earlier answers are required for each later step.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        queries: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: 'One concrete, self-contained sub-query.'
          }
        },
        researchFlags: {
          type: Type.ARRAY,
          description: `List the flags of sub-queries (e.g., [true, false, true]) that require open-web research. If a flag is not listed, it does not require research.
          In general, if the user requests information, open-web research should be performed.`,
          items: {
            type: Type.BOOLEAN,
            description: 'Flag of a sub-query that requires open-web research'
          }
        },
        dependencies: {
          type: Type.ARRAY,
          description: 'For every sub-query that relies on previous answers, specify its index and the indexes it depends on.',
          items: {
            type: Type.OBJECT,
            properties: {
              query_index: {
                type: Type.NUMBER,
                description: 'Index of the dependent sub-query'
              },
              depends_on: {
                type: Type.ARRAY,
                items: {
                  type: Type.NUMBER,
                  description: 'Indices of prerequisite sub-queries'
                }
              }
            },
            required: ['query_index', 'depends_on']
          }
        }
      },
      required: ['queries', 'dependencies']
    }
  }
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
  "get_dropdown_options",
  "select_dropdown_option",
  "get_simplified_page_context",
  "get_visible_text",
  "ask_user",
  "small_talk",
]

