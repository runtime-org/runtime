import { Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";
import { v4 as uuidv4 } from "uuid";
import { summarizeText } from "./plan.orchestrator";
import { synthesizeResults } from "./task.execution.llm";
import { useAppState } from "../hooks/useAppState";
import { taskEventEmitter } from "./emitters";

const emit = (event: string, data: any) => taskEventEmitter.emit(event, data);

interface TabQueryOptions {
    taskId: string;
    originalQuery: string;
    pages: Page[];
    onDone?: (result: string) => void;
    onError?: (error: string) => void;
}

export async function runTabQuery(opts: TabQueryOptions) {
    const {
        taskId,
        originalQuery,
        pages,
        onDone,
        onError
    } = opts;

    const { setSynthesisInProgress } = useAppState.getState();

    try {
        /*
        ** Emit start event
        */
        emit("workflow_update", {
            taskId,
            action: 'tab_query',
            status: 'initial',
            speakToUser: `Analyzing ${pages.length} tab(s) for: ${originalQuery}`,
            error: null
        });

        /*
        ** fetch content from all pages in parallel
        */
        const actionId1 = uuidv4();
        emit("task_action_start", {
            taskId,
            action: "fetch_tab_content",
            actionId: actionId1,
            speakToUser: `Reading content from ${pages.length} tab(s)`,
            status: "running",
            url: pages[0]?.url ?? ""
        });

        const pageContents = await Promise.all(
            pages.map(async (page, index) => {
                try {
                    const url = await page.url();
                    const title = await page.title();
                    
                    /*
                    ** get the visible text content
                    */
                    const content = await page.evaluate(() => {
                        /*
                        ** clone the body to avoid modifying the actual page
                        */
                        const bodyClone = document.body.cloneNode(true) as HTMLElement;
                        
                        /*
                        ** remove script and style elements from the clone
                        */
                        const scripts = bodyClone.querySelectorAll('script, style');
                        scripts.forEach(el => el.remove());
                        
                        /*
                        ** get text content from the clone
                        */
                        return bodyClone.innerText || '';
                    });

                    return {
                        url,
                        title,
                        content,
                        index
                    };
                } catch (error) {
                    console.error(`Error fetching content from tab ${index}:`, error);
                    return {
                        url: 'unknown',
                        title: `Tab ${index + 1}`,
                        content: '',
                        index
                    };
                }
            })
        );

        emit("task_action_complete", {
            taskId,
            action: "fetch_tab_content",
            speakToUser: `Successfully read ${pageContents.filter(p => p.content).length} tab(s)`,
            status: "success",
            error: null,
            actionId: actionId1
        });

        /*
        ** summarize content from all pages in parallel
        */
        const actionId2 = uuidv4();
        emit("task_action_start", {
            taskId,
            action: "summarize_content",
            actionId: actionId2,
            speakToUser: `Summarizing content from ${pageContents.filter(p => p.content).length} tab(s)`,
            status: "running",
            url: pages[0]?.url ?? ""
        });

        const summaries = await Promise.all(
            pageContents.map(async (pageData) => {
                if (!pageData.content) {
                    return null;
                }

                try {
                    const { summary } = await summarizeText({
                        rawText: pageData.content,
                        query: originalQuery
                    });

                    return {
                        url: pageData.url,
                        title: pageData.title,
                        summary
                    };
                } catch (error) {
                    console.error(`Error summarizing content from ${pageData.url}:`, error);
                    return {
                        url: pageData.url,
                        title: pageData.title,
                        summary: `(Failed to summarize content from ${pageData.title})`
                    };
                }
            })
        );

        /*
        ** filter out null summaries
        */
        const validSummaries = summaries.filter(Boolean);

        emit("task_action_complete", {
            taskId,
            action: "summarize_content",
            speakToUser: `Summarized ${validSummaries.length} tab(s)`,
            status: "success",
            error: null,
            actionId: actionId2
        });

        /*
        ** synthesize final result
        */
        const actionId3 = uuidv4();
        emit("task_action_start", {
            taskId,
            action: "synthesize_results",
            actionId: actionId3,
            speakToUser: "Synthesizing information from all tabs",
            status: "running",
            url: pages[0]?.url ?? ""
        });

        setSynthesisInProgress(taskId, true);

        /*
        ** format summaries for synthesis
        */
        const formattedSummaries = validSummaries.map((s, idx) => 
            `Source ${idx + 1}: ${s?.title} (${s?.url})\n${s?.summary}`
        );

        const finalResult = await synthesizeResults(
            originalQuery, 
            formattedSummaries
        );

        setSynthesisInProgress(taskId, false);

        emit("task_action_complete", {
            taskId,
            action: "synthesize_results",
            speakToUser: "Synthesis complete",
            status: "success",
            actionId: actionId3
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

        onDone?.(finalResult);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        emit("workflow_update", {
            taskId,
            action: 'error',
            status: 'failed',
            speakToUser: errorMessage,
            error: errorMessage
        });

        onError?.(errorMessage);
    }
}
