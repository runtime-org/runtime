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
