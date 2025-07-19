import { v4 as uuidv4 } from 'uuid';

import { handlePuppeteerAction } from "./pptr";
import { SeqRunOptions } from "./task.execution.schemas";
import { 
    emit, 
    pushHistory,
} from "./task.execution.helpers";
import { synthesizeResults } from "./task.execution.llm";
import { stepTranslator, planGenerator, evalEngine } from "./plan.orchestrator";


export async function runSequentialTask(opts: SeqRunOptions) {
    const {
        taskId,
        queries, 
        dependencies, 
        pageManager,
        originalQuery, 
        browserInstance, 
        model = 'gemini-2.5-flash'
    } = opts;

    console.log("🚀 DEBUG: Starting sequential task execution");
    console.log("📋 Task ID:", taskId);
    console.log("🎯 Original Query:", originalQuery);
    console.log("📝 Sub-queries:", queries);
    console.log("🔗 Dependencies:", dependencies);
    console.log("🤖 Model:", model);

    /*
    ** shared memory across queries tasks
    */
    const results: (string | undefined)[] = Array(queries.length).fill(undefined);

    /*
    ** iterate through SQ1, SQ2, ... SQn
    */
    for (let qIdx = 0; qIdx < queries.length; qIdx++) {
        const subQuery = queries[qIdx];
        console.log(`\n🔄 === PROCESSING SQ${qIdx} ===`);
        console.log(`📋 Sub-Query: ${subQuery}`);
        console.log(`💾 Current Results State:`, results.map((r, i) => `SQ${i}: ${r ? r.substring(0, 100) + '...' : '<pending>'}`));
        
        let feedback   = "";
        let attempts   = 0;
        let planDone   = false;

        /*
        ** build a deterministic plan -> steps 
        */
        while (!planDone && attempts < 5) {
            attempts++;
            console.log(`\n🎯 Attempt ${attempts}/5 for SQ${qIdx}`);
            
            if (feedback) {
                console.log(`📢 Feedback from previous attempt: ${feedback}`);
            }

            console.log(`📤 Calling planGenerator with:`);
            console.log(`   - subQuery: ${subQuery}`);
            console.log(`   - feedback: ${feedback}`);
            console.log(`   - results so far:`, results);

            const steps = await planGenerator({
                subQuery,
                queries,
                dependencies,
                results,
                feedback
            });

            console.log(`📥 Generated plan steps:`, steps);
        
            if (!steps.length) {
                console.log(`❌ Empty plan generated for SQ${qIdx}`);
                opts.onError?.(`Empty plan for SQ${qIdx}`);
                console.log(`SQ${qIdx} failed: empty plan`);
                continue;
            }

            /*
            ** conversation context for stepTranslator
            */
            let history: any[] = [];
            const currentPage = await pageManager();
            let finalAnswer   = "";

            console.log(`🚀 Executing ${steps.length} steps for SQ${qIdx}`);

            /* 
            ** run steps
            */
            for (let s = 0; s < steps.length; s++) {
                const sentence = steps[s];
                console.log("\n📝 Step", s+1, "/", steps.length, ":", sentence);
                console.log("📚 Current history length:", history.length);
                console.log("📚 History context:", history.map((h, i) => `${i}: ${JSON.stringify(h).substring(0, 100)}...`));

                console.log(`📤 Calling stepTranslator with step: "${sentence}"`);
                const toolCall = await stepTranslator(sentence, history);
                console.log(`📥 stepTranslator returned:`, toolCall);

                if (!toolCall) {
                    console.log(`❌ Translator failed at step ${s} of SQ${qIdx}`);
                    opts.onError?.(`Translator failed at step ${s} of SQ${qIdx}`);
                    console.log(`SQ${qIdx} failed: translator failed at step ${s}`);
                    continue;
                }

                /* 
                ** plan is done
                */
                if (toolCall.name === "done") {
                    finalAnswer = toolCall.args?.text ?? "";
                    console.log("✅ SQ", qIdx, "marked as done with answer:", finalAnswer);
                    emit("task_action_complete", {
                        taskId,
                        action : "done",
                        status : "success",
                        speakToUser: finalAnswer,
                        error  : null,
                        actionId: uuidv4()
                    });
                    break;
                }

                /* 
                ** run Puppeteer action with one retry
                */
                const actionId = uuidv4();
                console.log("🎬 Executing Puppeteer action: ", toolCall.name, "with params:", toolCall.args);
                
                emit("task_action_start", { 
                    taskId, 
                    action: toolCall.name, 
                    speakToUser: sentence, 
                    actionId, 
                    status:"running" 
                });

                let pptrRes = await handlePuppeteerAction({
                    actionDetails: { 
                        action: toolCall.name, 
                        parameters: toolCall.args, 
                        taskId 
                    },
                    currentPage,
                    browserInstance
                });
                
                console.log("📥 Puppeteer result (attempt 1):", pptrRes);

                if (pptrRes.data?.visibleText) {
                    console.log("📄 Visible text from page: ", pptrRes.data.visibleText);
                }
                
                if (!pptrRes.success) {
                    /*
                    ** retry once after a delay (2s)
                    */
                    console.log(`🔄 Retrying action after 2s delay...`);
                    await new Promise(r => setTimeout(r, 2000));
                    pptrRes = await handlePuppeteerAction({
                        actionDetails: { 
                            action: toolCall.name, 
                            parameters: toolCall.args, 
                            taskId 
                        },
                        currentPage,
                        browserInstance
                    });
                    console.log("📥 Puppeteer result (attempt 2):", {
                        success: pptrRes.success,
                        error: pptrRes.error,
                        dataSize: pptrRes.data ? Object.keys(pptrRes.data).length : 0,
                        visibleTextLength: pptrRes.data?.visibleText ? pptrRes.data.visibleText.length : 0
                    });
                }

                emit("task_action_complete", {
                    taskId,
                    action: toolCall.name,
                    speakToUser: sentence,
                    status: pptrRes.success ? "success" : "failed",
                    error: pptrRes.success ? undefined : pptrRes.error,
                    actionId
                });

                /*
                ** in case of pptr failure, do not emit error, retry again the task
                */
                if (!pptrRes.success) {
                    console.log(`❌ SQ${qIdx} failed: ${pptrRes.error}`);
                    finalAnswer = "failed execution, retry again";
                } 

                /* store visible text if this step might answer the SQ directly */
                // if (pptrRes.data?.visibleText && !finalAnswer)
                //    finalAnswer = pptrRes.data.visibleText.slice(0, 10048);
                // }

                /* 
                ** push action generated and the result to history
                */
                pushHistory(history, toolCall.name, toolCall.args, pptrRes.data);
                console.log(`📚 Updated history length: ${history.length}`);
            
                /*
                ** cap to 20 messages
                */
                if (history.length > 20) {
                    console.log(`✂️ Trimming history from ${history.length} to 20 messages`);
                    history = history.slice(-20);
                }
            }

            console.log(`\n🔍 Evaluating completeness of SQ${qIdx}`);
            console.log(`📤 Sending to evalEngine:`);
            console.log(`   - originalQuery: ${originalQuery}`);
            console.log(`   - subQuery: ${subQuery}`);
            console.log(`   - answer: ${finalAnswer}`);

            /*
            ** evaluate completeness of the current plan
            */
            const evalRes = await evalEngine({
                originalQuery,
                subQuery,
                answer: finalAnswer
            });
            
            console.log(`📥 Evaluation result:`, evalRes);
            
            if (evalRes.complete) {
                results[qIdx] = finalAnswer;
                planDone      = true;
                console.log(`✅ SQ${qIdx} marked as complete with result: ${finalAnswer}`);
            } else {
                feedback = evalRes.feedback || "(answer incomplete)";
                console.log(`SQ${qIdx} failed: ${feedback}`);
                //   emit("task_action_complete", {
                //     taskId,
                //     action : "evaluation",
                //     status : "error",
                //     speakToUser: `Retrying SQ${qIdx}: ${feedback}`,
                //     error  : feedback,
                //     actionId: uuidv4()
                //   });
                console.log(`🔄 SQ${qIdx} needs retry. Feedback: ${feedback}`);
            }
        }

        /*
        ** if the plan is not done or error, avoid retruning an error
        */
        if (!planDone) {
            console.log(`❌ SQ${qIdx} failed after 5 retries`);
            results[qIdx] = "failed execution, retry again";
            planDone = true;
        }
    }

    console.log("\n🏁 All sub-queries completed");
    console.log("📊 Final results:", results);
    
    console.log("\n🔄 Synthesizing final result...");
    console.log("📤 Sending to synthesizeResults:");
    console.log(`   - originalQuery: ${originalQuery}`);
    console.log(`   - results:`, results);
    console.log(`   - model: ${model}`);

    const finalResult = await synthesizeResults(originalQuery, results, model);
    console.log("📥 Final synthesized result:", finalResult);

    /*
    ** emit completion
    */
    emit("workflow_update", {
        taskId, 
        action: 'done', 
        status: 'completed', 
        speakToUser: finalResult, 
        error: null 
    });
    opts.onDone?.(finalResult);
}