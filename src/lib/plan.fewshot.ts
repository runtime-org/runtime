export const PLAN_FEW_SHOT: string = `
### EXAMPLE 1 - simple fact

Sub-Query: "Who is the author of the book The Great Gatsby?"
→ tool(generate_action_plan,{
  "steps":[
    "Perform a Google search for 'author of book The Great Gatsby'",
    "Retrieve the simplified structure of the current page to locate a reliable link",
    "Click the first reliable link (e.g., official site) using index",
    "Read the visible text on the linked page",
    "Return the author's name"
  ]
})

### EXAMPLE 2 - table lookup (flights)

Sub-Query: "Flight schedule from London to Edinburgh today"
→ tool(generate_action_plan,{
  "steps":[
    "Open a new tab on google.com if not already there",
    "Search Google for 'London to Edinburgh flight schedule today'",
    "Retrieve the simplified structure of the search-results page",
    "Click the first result that shows a timetable (e.g., Google Flights card or airline site)",
    "Read the visible text of the timetable page",
    "Extract the first flight's departure and arrival times",
    "Store the arrival time for later sub-queries",
    "Return the timetable text"
  ]
})

### EXAMPLE 3 - independent information (weather)

Sub-Query: "Hourly weather forecast in Edinburgh today"
→ tool(generate_action_plan,{
  "steps":[
    "Ensure the current page is google.com; if not, navigate there",
    "Search Google for 'hourly weather forecast Edinburgh today'",
    "Retrieve the simplified structure of the results page",
    "Click a reliable weather provider link by index (e.g., Met Office)",
    "Read the visible text of the forecast page",
    "Store the full hourly forecast for later sub-queries",
    "Return the forecast text"
  ]
})

### EXAMPLE 4 - dependent on earlier results

Sub-Query: "Weather in Edinburgh when the first London→Edinburgh flight arrives today"
→ tool(generate_action_plan,{
  "steps":[
    "Retrieve the previously stored arrival time from the flight schedule result",
    "Use the stored hourly forecast to find the weather that matches the arrival time",
    "Return the matching weather description and temperature"
  ]
})

### EXAMPLE 5 - date via days.to

Sub-Query: "When is Mother's Day?"
→ tool(generate_action_plan,{
  "steps":[
    "Perform a Google search for 'when is Mother's Day'",
    "Retrieve the simplified structure of the search-results page",
    "Click the first result that shows a date (days.to website)",
    "Read the visible text of the date page",
    "Return the date"
  ]
})
### END EXAMPLES
`;


export const STEP_FEW_SHOT: string = `
### EXAMPLES
Step: "Perform a Google search for 'author of book The Great Gatsby'"
→ tool(search_google,{
  "query": "author of book The Great Gatsby"
})

Step: "Retrieve the simplified structure of the current page to locate a reliable link"
→ tool(get_simplified_page_context, {})

Step: "Click the first reliable link (e.g., official site) using index 0"
→ tool(click_element_by_index,{
  "index": 0
})
### END EXAMPLES
`;