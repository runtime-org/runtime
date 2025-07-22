
/*
** split query
*/
export interface SplitQueryResponse {
  queries: string[];
  dependencies: { query_index: number, depends_on: number[] }[];
  researchFlags: boolean[];
}

/*
** query intent
*/
export type QueryIntent = 'small_talk' | 'web_research';