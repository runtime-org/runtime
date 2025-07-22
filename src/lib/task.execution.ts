import { v4 as uuidv4 } from 'uuid';

import { handlePuppeteerAction } from "./pptr";
import { SeqRunOptions } from "./task.execution.schemas";
import { 
    emit, 
    pushHistory,
    researchHelper,
    visitAndSummarizeUrl
} from "./task.execution.helpers";
import { synthesizeResults } from "./task.execution.llm";
import { 
    stepTranslator, 
    planGenerator, 
    evalEngine,
    summarizeText
} from "./plan.orchestrator";


export async function runSequentialTask(opts: SeqRunOptions) {
    const {
        taskId,
        queries, 
        dependencies, 
        pageManager,
        originalQuery, 
        browserInstance, 
        researchFlags = [],
        model = 'gemini-2.5-flash'
    } = opts;

    console.log("queries", queries);

    /*
    ** shared memory across queries tasks
    */
    const results: (string | undefined)[] = Array(queries.length).fill(undefined);
    const visitedUrls = new Set<string>();

    /*
    ** iterate through SQ1, SQ2, ... SQn
    */
    const currentPage = await pageManager();
    for (let qIdx = 0; qIdx < queries.length; qIdx++) {
        const subQuery = queries[qIdx];
        const needsResearch = researchFlags.includes(qIdx);
        console.log(`🔍 SQ${qIdx} needs research: ${needsResearch}`);

        /*
        ** if the SQ needs research, we need to run the research process and skip the deterministic plan
        */
        if (needsResearch) {
            console.log("🔎 SQ", qIdx, "→ research mode");

            /*
            ** Ggoogle search
            */
            await handlePuppeteerAction({
                actionDetails : {
                  action    : "go_to_url",
                  parameters: { url: `https://www.google.com/search?q=${encodeURIComponent(subQuery)}` },
                  taskId    : `sq${qIdx}-research`
                },
                currentPage,
                browserInstance
            });
            // await currentPage.waitForNavigation({ waitUntil: "networkidle0" });

            /*
            ** get the links
            */
            const { links } = await researchHelper({
                subQuery,
                browserInstance,
                currentPage,
                history: [],
                taskId
            })

            /*
            ** visit each link and summarize
            */
            const summaries: string[] = [];
            for (const { href } of links) {
                if (!href || visitedUrls.has(href)) continue;
                const { summary } = await visitAndSummarizeUrl({
                    subQuery,
                    href,
                    browserInstance,
                    currentPage,
                    history: [],
                    visitedUrls,
                    taskId
                });
                console.log("summary", summary);
                summaries.push(summary);
            }

            /*
            ** store the summaries and jump to the next SQ
            */
            results[qIdx] = summaries.join("\n\n") || "(no usefull information found)";
            continue; // jump into the next SQi
        }
        
        let feedback = "";
        let attempts = 0;
        let planDone = false;

        /*
        ** build a deterministic plan -> steps 
        */
        console.log("🔍 SQ", qIdx, subQuery);
        while (!planDone && attempts < 5) {
            attempts++;

            const steps = await planGenerator({
                subQuery,
                queries,
                dependencies,
                results,
                feedback
            });
        
            if (!steps.length) {
                opts.onError?.(`Empty plan for SQ${qIdx}`);
                continue;
            }

            /*
            ** conversation context for stepTranslator
            */
            let history: any[] = [];
            
            let finalAnswer   = "";

            /* 
            ** run steps
            */
            for (let s = 0; s < steps.length; s++) {
                const sentence = steps[s];
                // console.log("📚 History context:", history);

                const toolCall = await stepTranslator(sentence, history);

                if (!toolCall) {
                    opts.onError?.(`Translator failed at step ${s} of SQ${qIdx}`);
                    continue;
                }

                /* 
                ** plan is done
                */
                if (toolCall.name === "done") {
                    finalAnswer = toolCall.args?.text ?? "";
                    results[qIdx] = finalAnswer;
                    planDone = true;
                    emit("task_action_complete", {
                        taskId,
                        action : "done",
                        status : "success",
                        speakToUser: finalAnswer,
                        error : null,
                        actionId: uuidv4()
                    });
                    break;
                }

                /*
                ** dedup protection
                */
                if (toolCall.name === "go_to_url") {
                    const destUrl = toolCall.args?.url;
                    if (visitedUrls.has(destUrl)) {
                        continue;
                    }
                }

                /* 
                ** run Puppeteer action with one retry
                */
                const actionId = uuidv4();
                
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
                
                if (!pptrRes.success) {
                    /*
                    ** retry once after a delay (2s)
                    */
                    await new Promise(r => setTimeout(r, 700));
                    pptrRes = await handlePuppeteerAction({
                        actionDetails: { 
                            action: toolCall.name, 
                            parameters: toolCall.args, 
                            taskId 
                        },
                        currentPage,
                        browserInstance
                    });
                }

                /*
                ** if the tool is get_visible_text, we need to summarize the text
                */
                if (toolCall.name === "get_visible_text") {
                    const { summary } = await summarizeText({
                        rawText: (pptrRes.data as any).visibleText,
                        query: subQuery
                    });
                    (pptrRes.data as any).summary = summary;
                    console.log("summary", summary);
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
                    finalAnswer = "failed execution, retry again";
                }

                /* 
                ** push action generated and the result to history
                */
                pushHistory(history, toolCall.name, toolCall.args, pptrRes.data);
            
                /*
                ** cap to 20 messages
                */
                if (history.length > 20) {
                    history = history.slice(-20);
                }
            }

            /*
            ** evaluate completeness of the current plan
            */
            const evalRes = await evalEngine({
                originalQuery,
                subQuery,
                answer: finalAnswer
            });
            
            if (evalRes.complete) {
                results[qIdx] = finalAnswer;
                planDone  = true;
            } else {
                feedback = evalRes.feedback || "(answer incomplete)";
            }
        }

        /*
        ** if the plan is not done or error, avoid retruning an error
        */
        if (!planDone) {
            results[qIdx] = "failed execution, retry again";
            planDone = true;
        }
    }

    /*
    ** synthesize the results
    */
    const actionId = uuidv4();
    emit("task_action_start", {
        taskId,
        action: "synthesize_results",
        actionId,
        speakToUser: "Reasoning about the results",
        status: "running"
    });

    const finalResult = await synthesizeResults(originalQuery, results, model);

    emit("task_action_complete", {
        taskId,
        action: "synthesize_results",
        speakToUser: "Reasoning about the results",
        status: "success",
        actionId
    });
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
    await currentPage.close();
}