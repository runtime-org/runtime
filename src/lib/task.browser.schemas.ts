/*
** website skills
*/
export interface WebsiteSkills {
    domain: string;
    skills: SkillDefintiion[];
}

/*
** skill definition
*/
export interface SkillDefintiion {
    name: string;
    description: string;
    input?: Record<string, string>;
    output?: string;
    steps: SkillStep[];
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
   | "click_element_by_index";

/*
** skill step
*/
export interface SkillStep {
    action: StepAction;
    selector?: string;
    input_key?: string;
    index?: number;
    output_key?: string;
}

/*
** skill plan
*/
export interface SkillPlan {
    website: string;
    skill: SkillDefintiion;
    parameters: Record<string, unknown>;
}