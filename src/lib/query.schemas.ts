
/*
** split query
*/
export interface SplitQueryResponse {
  queries: string[];
  dependencies: { query_index: number, depends_on: number[] }[];
  researchFlags: boolean[];
}