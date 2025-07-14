import { Type } from '@google/genai';
/*
** plan declaration
*/
export const PlanDeclaration = {
  name: 'generate_action_plan',
  description: `
    Producde an ordored array of short sentences that, when executed 
    in order, will accomplish the sub-query using a web browser. 
    Sentence MUST NOT mention specific Runtime tools or code.
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
