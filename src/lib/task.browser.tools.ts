import { Type } from "@google/genai";

/*
** domain detection declaration
*/
export const DomainDetectDeclaration = {
    name: "detect_domains",
    description: "Detect the domains of websites that the user wants to interact with based on their query. Return only the base domains as an array.",
    parameters: {
      type: Type.OBJECT,
      properties: { 
        domains: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: "Array of base domains, e.g. ['amazon.com', 'google.com']" 
        } 
      },
      required: ["domains"]
    }
};

export const SummarizeSegmentDeclaration = [
  {
      name: "summarize_segment",
      description: "Summarize the segment and rewrite the remaining goal for the next browsing action on the next website(s) or current website",
      parameters: {
          type: Type.OBJECT,
          properties: {
              summary: { type: Type.STRING, description: "The summary of the segment" },
              next_query: { type: Type.STRING, description: "The next query to the next website(s)" }
          },
          required: ["summary", "next_query"]
      }
  }
]