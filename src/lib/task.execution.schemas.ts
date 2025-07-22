import { Browser, Page } from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';

export interface RunOptions {
    originalQuery: string;
    queries: string[];
    dependencies: {
        query_index: number;
        depends_on: number[];
    }[];
    taskId: string;
    sessionId: string;
    browserInstance: any;
    pageManager: any;

    model?: string;
    onDone?: (text: any) => void;
    onError?: (error: any) => void;
    onClose?: () => void;
}

/*
** extend RunOptions so the workflow runner can pass queries + deps
*/
export interface SeqRunOptions extends RunOptions {
    queries: string[];
    dependencies: {
        query_index: number;
        depends_on: number[];
    }[];
    researchFlags: number[];
}

/*
** research helper
*/
export interface ResearchHelperOptions {
    subQuery: string;
    maxLinks?: number;
    browserInstance: Browser;
    currentPage: Page;
    history: any[];
    taskId: string;
}

/*
** visit and summarize url options
*/
export interface VisitAndSummarizeUrlOptions {
    href: string;
    subQuery: string;
    browserInstance: Browser;
    currentPage: Page;
    history: any[];
    visitedUrls: Set<string>;
    taskId: string;
}