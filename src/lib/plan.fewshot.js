export const PLAN_FEW_SHOT = `
### EXAMPLE
Sub-Query: "Who is the author of the book The Great Gatsby?"
→ tool(generate_action_plan,{
  "steps":[
    "Perform a Google search for 'author of book The Great Gatsby'",
    "Retrieve the simplified structure of the current page to locate a reliable link",
    "Click the first reliable link (e.g., Wikipedia or official site) using index",
    "Read the content of the linked page",
    "Return the answer"
  ]
})
### END EXAMPLE
`;

export const STEP_FEW_SHOT = `
### EXAMPLES
Step: "Perform a Google search for 'author of book The Great Gatsby'"
→ tool(search_google,{
  "query": "author of book The Great Gatsby"
})

Step: "Retrieve the simplified structure of the current page to locate a reliable link"
→ tool(get_simplified_page_context, {})

Step: "Click the first reliable link (e.g., Wikipedia or official site) using index 0"
→ tool(click_element_by_index,{
  "index": 0
})
### END EXAMPLES
`;