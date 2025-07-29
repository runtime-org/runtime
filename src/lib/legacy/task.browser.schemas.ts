export interface BrowserActionOptions {
    taskId: string;
    sessionId: string;
    steps: string[];
    originalQuery: string;
    pageManager: any;
    browserInstance: any;
}

export interface EvaluateMacroArgs {
    macroStep : string;
    pageURL : string;
    ctx: any;
}