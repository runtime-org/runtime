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
