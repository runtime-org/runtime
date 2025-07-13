export interface PromptContext {
    originalQuery: string;
    subQuery: string;
    currentUrl: string;
    pageContext?: any;
}