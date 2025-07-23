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
** summary of the page
*/
// export const CustomSummaryDeclaration = {
//   name: "summarize_text",
//   description: `
//   Take raw visible text from a web page and decide:

//   1. If the text itself already contains information that could answer the sub-query, 
//   return a concise, factual 'summary' (strip ads / nav / cookie banners) and set 'need_research' to false.

//   2. If the page is mostly a directory or list of links relevant to the 
//      sub-query (e.g., Google search results, author publication list, table of contents), 
//      set 'need_research' to true.`,
//   parameters: {
//     type: Type.OBJECT,
//     properties: {
//       summary:        { type: Type.STRING,  description: "Concise summary" },
//       need_research:  { type: Type.BOOLEAN, description: "true if we must click several links to gather info" }
//     },
//     required: ["summary", "need_research"]
//   }
// };
export const SummaryDeclaration = {
  name: "general_summarize_text",
  description: `Take raw visible text from a web page and return a concise summary
   containing ONLY the information or annexes information that may help construct the answer to the current sub-query. 
   The summary should be factual and concise. Strip ads, navigation, cookie banners, unrelated sections, etc.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "Concise summary" }
    },
    required: ["summary"]
  }
}

/*
** pick links from the page
*/
export const PickLinksDeclaration = {
  name: "pick_links",
  description: `Given a list of interactive elements on the current page,
return the indices that should be visited next in order
to answer the sub-query.  Prefer elements whose href / text / aria-label
semantically match the sub-query.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      indices: {
        type : Type.ARRAY,
        items: { type: Type.NUMBER },
        description: "Element indices to visit, in a sensible order"
      }
    },
    required: ["indices"]
  }
};
