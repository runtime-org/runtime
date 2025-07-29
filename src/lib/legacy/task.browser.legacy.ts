
import { handlePuppeteerAction } from '../pptr';
import { emit } from "../task.execution.helpers"
import { BrowserActionOptions } from './task.browser.schemas';
import { 
    refineMacroPlan, 
    repairMacroStep,
    repairMicroStep,
    executeMicroStep,
    generateMicroSteps,
    evaluateMacro
} from './task.browser.helpers';

export async function runBrowserAction(opts: BrowserActionOptions) {
    const {
        taskId,
        sessionId,
        steps,
        originalQuery,
        pageManager,
        browserInstance
    } = opts;

    const page = await pageManager();

    /*
    ** show overlay
    */
    await handlePuppeteerAction({
        actionDetails: { action: "show_mesh_overlay", parameters: {}, taskId },
        browserInstance,
        currentPage: page
    });

    /*
    ** global refinement
    */
    let hiSteps: string[] = await refineMacroPlan({originalSteps: steps, userQuery: originalQuery});
    console.log("hiSteps", hiSteps);

    /*
    ** execute the macro plan
    */
   let macroIdx = 0;
    while (macroIdx < hiSteps.length) {

        let macro = hiSteps[macroIdx]; 
        let macroRetries = 0
        let macroDone = false;
        let lastMacroErr = "";
        let macroCtx: any = {};

        while (!macroDone && macroRetries < 3) {
            /**************************************************
            ** generate micro-steps for current macro
            */
            const microSteps = await generateMicroSteps({ sentence: macro, pageURL: page.url() });
            console.log("Macro", macro, microSteps);
            
            let microIdx = 0;
            let microOk = true;
            let history: any[] = [];


            /**************************************************
            ** execute micro-steps (with self-repair)
            */
            while (microIdx < microSteps.length && microOk) {
                let micro = microSteps[microIdx];
                let microRetry = 0;
                let microDone = false;
                let lastMicroErr = "";
                let accumMicroErrors: string[] = [];

                while (!microDone && microRetry < 3) {

                    const execResult = await executeMicroStep({
                        sentence: micro,
                        taskId,
                        page,
                        browser: browserInstance,
                        history
                    });

                    if (execResult.success) {
                        microDone = true;
                        microIdx += 1;
                        macroCtx = execResult.ctx;
                    } else {
                        lastMicroErr = execResult.error || "unknown error";
                        accumMicroErrors.push(lastMicroErr);
                        microRetry += 1;

                        if (microRetry < 3) {
                            /* 
                            ** adapt to an alternative instruction
                            */
                            micro = await repairMicroStep({
                                failing: micro,
                                lastError: lastMicroErr,
                                pageURL: page.url()
                            });
                        }
                    }   
                }

                /*
                ** still failing after 3 attempts -> macro fails too (and go and repair the macro)
                */
                if (!microDone) {
                    microOk = false;
                    lastMacroErr = accumMicroErrors.join("\n");
                }
            } // micro-steps loop
            
            /*
            ** evaluate or repair the macro
            */
            if (microOk) {
                const { complete, feedback } = await evaluateMacro({
                    macroStep: macro,
                    pageURL: page.url(),
                    ctx: macroCtx
                });
                console.log("Evaluate Macro", macro, "complete", complete, "feedback", feedback);

                if (complete) {
                    macroDone = true;
                    macroIdx += 1;
                } else {
                    /*
                    ** macro failed, then repair it
                    */
                    macroRetries += 1;
                    if (macroRetries < 3) {
                    macro = await repairMacroStep({
                        failingStep: macro,
                        lastError: feedback,
                        pageURL: page.url()
                    });
                    hiSteps[macroIdx] = macro;
                    } else {
                        /*
                        ** macro failed 3 times -> skip to next to avoid infinite loop
                        */
                        macroIdx += 1;
                    }
                }
            } else {
                /*
                ** macro failed, then repair it
                */
                macroRetries += 1;
                if (macroRetries < 3) {
                    macro = await repairMacroStep({
                        failingStep: macro,
                        lastError: lastMacroErr,
                        pageURL: page.url()
                    });
                    hiSteps[macroIdx] = macro;
                } else {
                    /*
                    ** macro failed 3 times -> skip to next to avoid infinite loop
                    */
                    macroIdx += 1;
                }
            }
        } // macro-steps loop
    } // macro-steps loop

    /* clean up */
    await handlePuppeteerAction({
        actionDetails: { action: "hide_mesh_overlay", parameters: {}, taskId },
        browserInstance,
        currentPage: page
    });

    emit("workflow_update", {
        taskId,
        action: "done",
        status: "completed",
        speakToUser: "Browser action finished",
        error: null
    });
    
}
