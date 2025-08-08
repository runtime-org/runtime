## Skills based browser agent

Previous AI browser agents (such as Comet, Dia, Genspark, browser-use, or browserbase) rely heavily on the DOM at execution time and manipulate it using heuristic methods. This approach makes processing requests slow.

We took a different approach: instead of manipulating the DOM at runtime/render-time, we use the tag attributes present in the DOM after the initial rendering by Blink. These attributes serve as gateways to locate elements such as `button`, `a`, `div`, `span`, and others.

We call these "skills." Every website has a set of predefined actions that a human can perform. For example, on amazon.com, the basic functions a user might perform include:  
 - searching for products, 
 - reading product information (such as title, price, discount, delivery time, rating, comments, etc.), 
 - adding items to the cart, 
 - viewing the cart, 
 - tracking deliveries, 
 - and more.

By leveraging predefined skills instead of interacting with the live DOM, we achieve significant speed improvements. This approach also removes the need for the LLM to reason about which button to click or which element to hover over. 

Important: While we recognize that this method is not infinitely scalable, we have developed a solution to address scalability challenges and will be sharing more details soon. Follow us for updates!

---

We decided to call it, Skill-Based-Protocol.
It consist of two parts. 
- The first part is generating the skills or teaching AI the action you will like it to do. This process has to be done on the fly. We will post about this process soon. For the moment, we use hand crafted skills generation. 
- The second part, is the execution of the task/action on the browser using the skills. The content of skills is currently declarative.

A skill is a set of functions, and each function has a set of actions.
`search_products` is a skill/function of amazon.*:

```json
{
    "name": "search_products",
    "description": "Search for a product on Amazon. this skill will take the user query as input, and perform the search on amazon.com and it will return the list of results of products.",
    "input":  { "text": "string" },
    "output": "results",
    "steps": [
    { "action": "navigate_to_url", "url": "https://www.amazon.com" },
    { "action": "wait_for_selector", "selector": "#twotabsearchtextbox" },
    { "action": "click",              "selector": "#twotabsearchtextbox" },
    { "action": "type",               "selector": "#twotabsearchtextbox", "input_key": "text" },
    { "action": "press_enter" },
    { "action": "wait_for_selector",  "selector": "div[data-component-type='s-search-result'][data-asin]:not([data-asin=''])" },
    { "action": "scroll_down",        "times": 3 },
    {
        "action":     "extract_list",
        "selector":   "div[data-component-type='s-search-result'][data-asin]:not([data-asin=''])",
        "schema": {
        "asin": "@data-asin",
        "title": "[data-cy='title-recipe'] a h2::text",
        "price": "[data-cy='price-recipe'] .a-row [aria-describedby='price-link'] .a-price .a-offscreen::text",
        "link": "[data-cy='title-recipe'] a::href"
        },
        "output_key": "results"
    }
    ]
}
```

---

### Why skills?
A typical Amazon user doesn't perform 50 actions to buy a product. An average user searches for products with competitive pricing and fast delivery. These actions are consistent across all users. Instead of feeding live or processed live DOM data to the Language Model to predict the next action heuristically, this approach is computationally expensive. For a single website like Amazon, if you apply this strategy for 1,000 users, where each user request consumes 100,000 tokens, you would end up using at least 1 million tokens. However, with skills, they function like a factorization method—doing the work once for a single user and making those skills available for the other 999 users.