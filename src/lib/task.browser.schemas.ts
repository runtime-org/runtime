import { JSONSchema7 } from "json-schema";
/*
** website skills
*/
export interface WebsiteSkills {
    domain: string;
    description?: string;
    skills: {
        name: string;
        description: string;
        input?: Record<string, unknown>;
        output?: string;
        steps?: SkillStep[];
    }[];
}

/*
** step action
*/
export type StepAction = 
   | "click"
   | "type"
   | "press_enter"
   | "wait_for_selector"
   | "extract_list"
   | "extract_fields"
   | "navigate_back"
   | "click_element_by_index"
   | "navigate_to_url";

export interface ExecOps {
    taskId: string;
    browser: any;
    pageManager: () => Promise<any>;
    plan: any;
    skillMaps: WebsiteSkills[];
}
/*
** skill step
*/
export interface SkillStep {
    action: StepAction;
    selector?: string;
    url?: string;
    input_key?: string;
    index?: number;
    output_key?: string;
}


/*
** remote options
*/
export interface RemoteOptions {
    company?: string;
    repo?: string;
    branch?: string;
}

/*
** browser run options
*/
export interface BrowserRunOptions {
    taskId: string;
    originalQuery: string;
    browserInstance: any; // Browser to avoid silent errors
    pageManager: () => Promise<any>; // Page;
    steps: string[];
}

/*
** browser plan declaration
*/
export interface BrowserPlan extends JSONSchema7 {
    name: string;
}