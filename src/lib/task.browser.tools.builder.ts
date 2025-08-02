import { WebsiteSkills } from "./task.browser.schemas";
import { Type } from "@google/genai"

/*
** collect every skills name from every website map
*/
function flatSkills(sites: WebsiteSkills[]): string[] {
    return sites.flatMap((site) => site.skills.map((skill) => skill.name));
}

export function buildMacroTool(
    sites: WebsiteSkills[]
) {
    const skillNames = flatSkills(sites);

    return {
        name: "generate_skill_pipeline",
        description: `
Return an OBJECT with a single key "skills".
"skills" is an ordered ARRAY; each element invoke ONE skill.  
Allowed parameters key are "text" (STRING) and "number" (NUMBER).
Leave it empty {} when the skill has no input.
        `,
        parameters: {
            type: Type.OBJECT,
            properties: {
                skills: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            skill: { type: Type.STRING, enum: skillNames },
                            parameters: { 
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    number: { type: Type.NUMBER }
                                },
                                required: []
                            }
                        },
                        required: ["skill", "parameters"]
                    }
                }
            },
            required: ["skills"]
        }
    };
}

