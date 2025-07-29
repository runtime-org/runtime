import { Type } from '@google/genai';

/*
** query analysis
*/
export const QueryAnalysisDeclaration = {
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
          description: `List the indices of sub-queries (e.g., [0, 1, 3]) that require open-web research. If an index is not listed, it does not require research.
          In general, if the user requests information, open-web research should be performed.`,
          items: {
            type: Type.NUMBER,
            description: 'Index of a sub-query that requires open-web research'
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
      required: ['queries', 'dependencies', 'researchFlags']
    }
};

/*
** small talk response
*/
export const SmallTalkDeclaration = {
  name: "small_talk_response",
  description:
    `Use when the user is clearly making polite conversation or the request
     requires no information gathering. Return a direct natural-language reply.
     If the user is asking for a joke, return a joke. Or if the user is asking for factual information, 
     return a fact. For example, if the user asks "What is the capital of France?", return "The capital of France is Paris."`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: "A concise, friendly reply from the assistant."
      }
    },
    required: ["reply"]
  }
};
  
/*
** browser action declaration
*/
export const BrowserActionDeclaration = {
  name: "browser_action",
  description: `
Use this tool to generate a step-by-step deterministic *plan* for accomplishing 
an on-page action (e.g. "booking flight", "searching hotel", "searching for a job", "asking question about a page", in general, anything that can be done on a web page).  
Each step describes **what** to do on the web page; the executor layer (Puppeteer) will translate it into clicks, typing, scrolling, etc.
The plan should be a list of steps, each step is a string that describes what to do on the web page.
`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      steps: {
        type: Type.ARRAY,
        description:
          "Ordered list of atomic UI actions that the agent must perform.",
        items: {
          type: Type.STRING
        }
      }
    },
    required: ["steps"]
  }

}