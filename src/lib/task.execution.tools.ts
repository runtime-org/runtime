import { Type } from "@google/genai";

export const SynthesisDeclaration = [
    {
      name: 'synthesize_results',
      description: 'Synthesize multiple research results into a comprehensive final answer',
      parameters: {
        type: Type.OBJECT,
        properties: {
          synthesized_answer: {
            type: Type.STRING,
            description: 'The comprehensive, well-structured answer that combines all research findings'
          },
          key_findings: {
            type: Type.ARRAY,
            description: 'List of key findings from the research',
            items: {
              type: Type.STRING,
              description: 'A key finding or insight'
            }
          },
          confidence_level: {
            type: Type.NUMBER,
            description: 'Confidence level in the synthesis (0.0 to 1.0)'
          },
          gaps_or_limitations: {
            type: Type.STRING,
            description: 'Any gaps or limitations in the synthesized answer'
          }
        },
        required: ['synthesized_answer', 'key_findings', 'confidence_level', 'gaps_or_limitations']
      }
    }
  ];