import { Type } from '@google/genai';

/*
** plan declaration
*/
export const PlanDeclaration = {
  name: 'generate_action_plan',
  description: `
    Produce an ordered array of short sentences that, when executed 
    in order, will accomplish the sub-query using a web browser. 
    Sentence MUST NOT mention specific Runtime functions or code.
    `,
  parameters: {
    type: Type.OBJECT,
    properties: {
      steps: {
        type: Type.ARRAY,
        items: { 
            type: Type.STRING,
            description: "One atomic browsing action in plain English"
        },
      }
    },
    required: ['steps']
  }
};

/*
** result plan evaluator
*/
export const EvaluateAnswerTool = {
  name: "evaluate_answer",
  description:
    `Judge whether a given answer fully and correctly satisfies the sub-query in the context of the original user request.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      complete: {
        type: Type.BOOLEAN,
        description: "true if the answer is sufficient and no more browsing steps are needed"
      },
      feedback: {
        type: Type.STRING,
        description: "If complete is false, explain briefly what is missing"
      }
    },
    required: ["complete","feedback"]
  }
}

/*
** summary tool declaration
*/
export const SummaryDeclaration = {
    name: "summarize_text",
    description:
      `Take raw visible text from a web page and return a concise summary 
      containing ONLY the information or annexes information that may help construct the answer to the current sub-query.
      The summary should be factual and concise.
      Strip ads, navigation, cookie banners, unrelated sections, etc.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary:   { type: Type.STRING,  description: "Summary of the raw visible text" }
      },
      required: ["summary"]
    }
};
