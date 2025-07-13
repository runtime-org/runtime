export const FEW_SHOT = `
### EXAMPLE 1 (sequential)
Q: "When was the author of the book 'The Great Gatsby' born?"
→ tool(analyze_query_strategy,{
  "strategy":"sequential",
  "queries":[
    "Who is the author of the book The Great Gatsby?",
    "When was the author of this book born?"
  ],
  "dependencies":[
    {"query_index":1,"depends_on":[0]}
  ]
})

### EXAMPLE 2 (parallel)
Q: "I am in London and want to know the weather when the first flight arrives in Edinburgh today."
→ tool(analyze_query_strategy,{
  "strategy":"parallel",
  "queries":[
    "Flight schedule from London to Edinburgh today",
    "Hourly weather forecast in Edinburgh today"
  ],
  "dependencies":[
    {"query_index":1,"depends_on":[0]}
  ]
})
### END EXAMPLES
`