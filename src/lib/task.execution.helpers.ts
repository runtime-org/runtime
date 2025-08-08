import { taskEventEmitter } from "./emitters";
import { handlePuppeteerAction } from "./pptr";
import { ResearchHelperOptions, VisitAndSummarizeUrlOptions } from "./task.execution.schemas";
import { Page, Browser } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";
import { PickLinksDeclaration } from "./plan.tools";
import { callLLM } from "./llm.engine";
import { summarizeText } from "./plan.orchestrator";
import { v4 as uuidv4 } from 'uuid';

/*
** get the function call from the response
*/
export function getFnCall(resp: any): { name: string; args: Record<string, any> } | null {
    const call = resp?.functionCalls?.[0];
    return call
}

/*
** emit an event
*/
export function emit(event: string, payload: any) {
    try {
        taskEventEmitter.emit(event, payload);
    } catch (error) { }
}

/*
** truncate a string to a given length
*/
export function truncate(str: string, maxLength: number) {
    return str.length > maxLength ? str.slice(0, maxLength) + "..." : str;
}

/*
** deep dive page lookup
*/
export async function researchHelper(opts: ResearchHelperOptions): Promise<{links: { index: number, href: string }[]}> {
    const {
        subQuery,
        maxLinks = 7,
        browserInstance,
        currentPage,
        history,
        taskId
    } = opts;

    /*
    ** get the interactive elements
    */
    const simplifyingId = uuidv4();

    emit("task_action_start", { 
        actionId: simplifyingId, 
        action: "get_simplified_page_context", 
        speakToUser: `Looking for links to answer: ${subQuery}`,
        taskId: taskId,
        status: "running",
        url: currentPage.url()
    });

    const pptrRes = await handlePuppeteerAction({
        actionDetails : {
          action : "get_simplified_page_context",
          parameters: { max_elements: 10000 },
          taskId : taskId
        },
        currentPage,
        browserInstance
    });

    pushHistory(
        history, 
        'get_simplified_page_context', 
        { max_elements: 10000 },
        pptrRes.data
    );

    /*
    ** build element map
    */
    const elementMap: Record<number, any> = (pptrRes.data as any)?.interactiveElements ?? {};

    /*
    ** craft prompt 
    */
    const listForLLM = Object.values(elementMap)
        .map((e: any) => {
            return `${e.index}. [${e.tag}] ${e.accessibleName} - ${truncate(e.href, 40)}`;
        })
        .join("\n");
    
    const prompt = `
You are a helpful assistant that helps users find information on a web page.
you should use the pick_links tool to select the indices of the elements that should be visited and return the function call.

Sub-query: "${subQuery}"

Here is a list of interactive elements (index, tag, accessibleName, href):

${listForLLM}

Based on the list of elements above and the sub-query, select up to ${maxLinks} indices 
that should be visited, in order, to answer the sub-query. Prioritize the 3 to 4 most relevant indices.

Return the indices as an array of numbers using indices as the keys not pick_links`

    const pickResp = await callLLM({
        provider: 'gemini',
        tier: 'smart',
        contents: [{ role : "user", parts: [{ text: prompt }] }],
        config: {
            temperature : 0,
            maxOutputTokens : 100000,
            mode : "ANY",
            tools : [{ functionDeclarations: [PickLinksDeclaration] }]
        },
        ignoreFnCallCheck: true
    });

    emit("task_action_complete", {
        actionId: simplifyingId,
        action: "get_simplified_page_context",
        taskId: taskId,
        status: "success",
    });

    const fn = getFnCall(pickResp);

    const indices = (fn?.args?.indices ?? []).slice(0, maxLinks) as number[];
    
    /*
    ** map indices -> hrefs
    */
    const links = indices
        .map(i => ({
            index: i,
            href: Object
                    .values(elementMap)
                    .find((el: any) => el.index === i)?.href
        }));

    return { links };

}

/*
** visitze and summarize url
*/
export async function visitAndSummarizeUrl(opts: VisitAndSummarizeUrlOptions) {
    const {
        href,
        subQuery,
        browserInstance,
        currentPage,
        history,
        taskId,
        visitedUrls,
    } = opts;

    /*
    ** visit the url
    */
    const visitingId = uuidv4();
    emit("task_action_start", {
        actionId: visitingId,
        action: "go_to_url",
        speakToUser: `Visiting: ${truncate(href, 40)}`,
        taskId: taskId,
        status: "running",
        url: currentPage.url()
    });
    const navRes = await handlePuppeteerAction({
        actionDetails: {
            action: "go_to_url",
            parameters: { url: href },
            taskId
        },
        currentPage,
        browserInstance
    })

    // pushHistory(history, "go_to_url", { url: href }, navRes.data);

    /*
    ** read the visible text
    */
    const textRes = await handlePuppeteerAction({
        actionDetails: {
            action: "get_visible_text",
            parameters: {},
            taskId
        },
        currentPage,
        browserInstance
    })
    emit("task_action_complete", {
        actionId: visitingId,
        action: "get_visible_text",
        taskId: taskId,
        status: "success",
    });

    // pushHistory(history, "get_visible_text", {}, textRes.data);

    /*
    ** summarize the text
    */
    const summarizingId = uuidv4();
    emit("task_action_start", {
        actionId: summarizingId,
        action: "summarize_text",
        speakToUser: `Summarizing the text`,
        taskId: taskId,
        status: "running",
        url: currentPage.url()
    });
    const { summary } = await summarizeText({
        rawText: (textRes.data as any)?.visibleText || "",
        query : subQuery
    });

    emit("task_action_complete", {
        actionId: summarizingId,
        action: "summarize_text",
        speakToUser: `Summarized: ${truncate(summary, 40)}`,
        taskId: taskId,
        status: "success",
    });

    visitedUrls?.add(href);

    return { url: href, summary }
}

/*
** visit up to max parallel url in parallel and return the summaries
** fall back to sequential retries if something throws
*/
export async function summarizeLinksInParallel (opts: {
    subQuery: string;
    links:     { href: string }[];
    pageManager: () => Promise<Page>;
    browserInstance: Browser;
    visitedUrls: Set<string>;
    taskId:      string;
    maxParallel?: number;
  }): Promise<string[]> {
  
    const {
      subQuery,
      links,
      pageManager,
      browserInstance,
      visitedUrls,
      taskId,
      maxParallel = 5           // hard cap per wave – tweak to taste
    } = opts;
  
    /*
    ** de-dupe + trim so we never spawn more work than we need
    */
    const clean = links
        // .filter(l => l.href && !visitedUrls.has(l.href))
        .slice(0, maxParallel);
  
    const jobs = clean.map(async ({ href }) => {
        console.log("visiting", href);
        visitedUrls.add(href);                // reserve immediately
    
        const page = await pageManager();     // ← gets an idle tab or opens one
        try {
            const { summary } = await visitAndSummarizeUrl({
                subQuery,
                href,
                browserInstance,
                currentPage: page,
                history:     [],
                visitedUrls,
                taskId
            });
            console.log("summary", summary);
            return summary ?? "";
        } catch (err) {
            console.error(`Summarising ${href} failed`, err);
            return "";
        } finally {
            try { 
                // await page.close(); 
            } catch (err) { }
        }
    });
  
    /*
    ** wait for all workers in this wave
    */
    const settled = await Promise.allSettled(jobs);
    return settled
      .filter(r => r.status === "fulfilled" && r.value)
      .map(r => (r as PromiseFulfilledResult<string>).value);
}
  
/*
** push simplified page context to history
*/
export function pushHistory(history: any[], toolName: string, args: any, rawResult: any) {
    
    if (toolName === 'get_simplified_page_context') {
        const userMessage = {
            role: 'user',
            parts: [ { functionCall: { name: toolName, args: { ...args, data: rawResult } } } ]
        }
        history.push(userMessage);
    } else if (toolName === 'get_visible_text') {
        const userMessage = {
            role: 'user',
            parts: [ { text: `Successfully retrieved visible text: ${rawResult.summary}` } ]
        }
        history.push(userMessage);
    } else {
        const userMessage = {
            role: 'user',
            parts: [ { text: semanticPptrExplanation(toolName, args, rawResult) } ]
        }
        history.push(userMessage);
    }   
}

/*
** semantic explanation of the pptr action
*/
export function semanticPptrExplanation(fnName: string, fnArgs: any, rawResult?: any) {
    let description = '';
    
    switch (fnName) {
        /*
        ** done
        */
        case 'done':
            description = 'Successfully completed the task';
            break;
            
        /*
        ** navigation actions
        */
        case 'search_google':
            description = `Successfully searched Google for "${fnArgs.query}"`;
            break;
            
        case 'go_to_url':
            description = `Successfully navigated to ${fnArgs.url}`;
            break;
            
        case 'go_back':
            description = 'Successfully navigated back to the previous page';
            break;
            
        case 'go_forward':
            description = 'Successfully navigated forward to the next page';
            break;
            
        case 'refresh_page':
            description = 'Successfully refreshed the current page';
            break;
            
        /*
        ** timing/waiting
        */
        case 'wait':
            description = `Successfully waited ${fnArgs.seconds || 3} seconds`;
            break;
            
        /*
        ** element interaction
        */
        case 'click_element_by_index':
            description = `Successfully clicked element ${fnArgs.index}`;
            break;
            
        case 'input_text':
            description = `Successfully entered text "${fnArgs.text}" into element ${fnArgs.index}`;
            break;
            
        /*
        ** scrolling
        */
        case 'scroll_down':
            description = fnArgs.amount ? `Successfully scrolled down ${fnArgs.amount} pixels` : 'Successfully scrolled down';
            break;
            
        case 'scroll_up':
            description = fnArgs.amount ? `Successfully scrolled up ${fnArgs.amount} pixels` : 'Successfully scrolled up';
            break;
            
        case 'scroll_to_text':
            description = `Successfully scrolled to find "${fnArgs.text}"`;
            break;
        
        case 'get_visible_text':
            description = `Successfully retrieved visible text: ${rawResult.summary}`;
            break;
            
        /*
        ** page state/context
        */
        case 'get_simplified_page_context':
            description = 'Successfully retrieved page context and interactive elements';
            break;
            
        /*
        ** runtime control
        */
        case 'ask_user':
            description = `Successfully asked user: "${fnArgs.question}"`;
            break;
            
        case 'small_talk':
            description = 'Successfully engaged in conversation';
            break;
            
        default:
            description = `Successfully executed ${fnName}`;
            break;
    }
    
    return description;
}