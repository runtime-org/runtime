import { SkillRegistry } from "./task.browser.skill.registry";
import { WebsiteSkills } from "./task.browser.schemas";
import { getFnCall } from "./task.browser.helpers";
import { DomainDetectDeclaration } from "./task.browser.tools";
import { buildMacroTool } from "./task.browser.tools.builder";
import { callLLM } from "./llm.engine";
 
/*
** skill registry
*/
const reg = new SkillRegistry();

/*
** resolve skill plan
*/
export async function generateMacroPlan({
        sites,
        query
    }: {
        sites: WebsiteSkills[],
        query: string
    }): Promise<any> {

    const macroTool = buildMacroTool(sites);
    console.log("macroTool", macroTool);

    const config = {
        temperature: 0.0,
        maxOutputTokens: 8192,
        mode: "ANY",
        tools: [{ functionDeclarations: [ macroTool ] }]
    };

    const FEW_SHOTS = `
EXAMPLE 1:
User Request: "search for the USB C under 25 dollars cable in amazon, and put it in my cart"
{
  "skills": [
    { "skill": "search_products",          "parameters": { "text": "USB C under 25 dollars cable" } },
    { "skill": "open_result_by_index",     "parameters": { "index": 0 } },
    { "skill": "extract_product_details",  "parameters": {} },
    { "skill": "add_current_product_to_cart", "parameters": {} }
  ]
}


EXAMPLE 2:
User Request: "check my gmail, and see the latest drone received from dji, and try to look for it on amazon, and add the cheapest one to my cart"
{
  "skills": [
    { "skill": "search_emails", "parameters": { "text": "drone from dji" } },
    { "skill": "open_email_by_index", "parameters": { "number": 0 } },
    { "skill": "extract_email_details", "parameters": {} },
    { "skill": "search_products", "parameters": { "text": "<product name from previous step>" } },
    { "skill": "open_result_by_index", "parameters": { "number": 0 } },
    { "skill": "extract_product_details", "parameters": {} },
    { "skill": "add_current_product_to_cart", "parameters": {} }
  ]
}
- add_current_product_to_cart: parameters: {}

EXAMPLE 3:
User Request: "check my gmail, and see the latest drone received from dji, and try to look for it on amazon, and give me the cheapest one"
{
  "skills": [
    { "skill": "search_emails", "parameters": { "text": "drone from dji" } },
    { "skill": "open_email_by_index", "parameters": { "number": 0 } },
    { "skill": "extract_email_details", "parameters": {} },
    { "skill": "search_products", "parameters": { "text": "<product name from previous step>" } },
    { "skill": "open_result_by_index", "parameters": { "number": 0 } },
    { "skill": "extract_product_details", "parameters": {} }
  ]
}
`

    // skills generator
    const generateSkillsSection = (sites: WebsiteSkills[]): string => {
        return sites.map(site => {
            const skillsList = site.skills.map(skill => 
                `- ${skill.name}: ${skill.description}`
            ).join('\n');
            
            return `Skills of ${site.domain}:\n${skillsList}`;
        }).join('\n\n');
    };

    const skillsSection = generateSkillsSection(sites);

    const prompt = `
You are a plan generator for a browser automation task on specific websites.
You will be given a list of skills and a user request. The skills are specific to the websites you are going to interact with. 
And each skill has a description of what it does and the input it needs optionally.
You must generate a plan that will fully satisfy the user request.
If the user request involves multiple websites, you will be provided a list of skills for each website.
And each function has already some step for it execution, you don't need to worry about the steps, just focus on the successfull execution of the functions/skills.

Note: You should use the following tool to generate the skill pipeline: generate_skill_pipeline

## Skills
${skillsSection}

## Examples
${FEW_SHOTS}

Here is the user request:
User request: ${query}
Plan as list of skills:
`

    console.log("prompt", prompt);
    const resp = await callLLM({
        modelId: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt } ] }],
        config,
        ignoreFnCallCheck: true
    });

    console.log("resp", resp);

    const fn = getFnCall(resp);
    if (!fn?.args?.skills) throw new Error("Plan generation failed");

    return fn.args;
}

/*
** detect target site
*/
const FEW_SHOTS = `
EXAMPLE 1:
User Request: "search for the cheapiest USB C cable in amazon, and put it in my cart"
Steps: ["Go to amazon.com", "Search for \"cheapest USB C cable\"", "Click on the add to cart button for the cheapest USB C cable"]
Domains: ["amazon.com"]

EXAMPLE 2:
User Request: "check slack, and tell me the car brand of Alex"
Steps: ["Go to Slack.", "Search for Alex.", "Find information about Alex's car brand."]
Domains: ["slack.com"]

EXAMPLE 3:
User Request: "check my gmail, and see the latest drone received from dji, and try to look for it on amazon, and give me the cheapest one"
Steps: ["Go to Gmail.", "Search for emails from DJI about drones.", "Identify the latest drone model received.", "Go to Amazon.", "Search for the identified DJI drone model.", "Find the cheapest option."]
Domains: ["gmail.com", "amazon.com"]

EXAMPLE 4:
User Request: "check for the email received from cursor and notion, and tell me the latest update they have"
Steps: ["Go to Gmail.", "Search for emails from Cursor and Notion.", "Find the latest update from each sender."]
Domains: ["gmail.com"]
`

export async function detectWebsites(
    {query, steps}: 
    {query: string, steps: string[]}
): Promise<string[]> {

    const _steps = steps.map((step) => `"${step}"`).join(", ");

    const prompt = `You are a domain detector.
You will be given a user request and a list of steps. You must use the steps to determine the domains of websites that the user intends to interact with.
Your task is to identify the domains of the websites that the user intends to interact with. Please use steps interactions to determine the domains.
Please return only the domain names, and do not include any additional text.

Notes:
- The user request may refer to one or more domains.
- Sometimes, the user request may mention other websites in the query, but the steps may not involve that website, so you should not mention those websites.

${FEW_SHOTS}

Assistant:
User request: ${query}
Steps: [${_steps}]
Domains:
`;

    const config = {
        temperature: 0.0,
        maxOutputTokens: 8192,
        mode: "ANY",
        tools: [{ functionDeclarations: [DomainDetectDeclaration] }]
    };
    const resp = await callLLM({
      modelId: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
      ignoreFnCallCheck: true
    });

    const fn = getFnCall(resp);

    if (!fn?.args?.domains) throw new Error("Domain detection failed");
    return fn.args.domains as string[];
}