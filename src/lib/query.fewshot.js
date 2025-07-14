export const QUERY_FEW_SHOT = `
### EXAMPLE 1 (sequential)
Q: "When was the author of the book 'The Great Gatsby' born?"
→ tool(analyze_query_strategy,{
  "queries":[
    "Who is the author of the book The Great Gatsby?",
    "When was the author of this book born?"
  ],
  "dependencies":[
    { "query_index":1, "depends_on":[0] }
  ]
})

### EXAMPLE 2 (sequential-chain)
Q: "I am in London and want to know the weather when the first flight arrives in Edinburgh today."
→ tool(analyze_query_strategy,{
  "queries":[
    "Flight schedule from London to Edinburgh today",
    "Hourly weather forecast in Edinburgh today",
    "Weather in Edinburgh when the first London-Edinburgh flight arrives today"
  ],
  "dependencies":[
    { "query_index":1, "depends_on":[0] },
    { "query_index":2, "depends_on":[0,1] }
  ]
})
### END EXAMPLES
`;
