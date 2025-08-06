<a id="top"></a>

<img src="./public/logo/logo_runtime.png" alt="Runtime" width="full" style="border-radius: 5px;"/>

<div style="height: 32px;"></div>

<p align="center">
  <a href="https://discord.gg/AN4WZYXqR4">
    <img src="https://img.shields.io/discord/1298389425905991791?logo=discord&label=Discord&labelColor=2C2F33&color=5865F2" alt="Chat on Discord" />
  </a>
  <img alt="License: GPL-3.0" src="https://img.shields.io/badge/License-GPLv3-blue.svg" />
</p>

<div align="center">
  <h1>Skills-based browser agent</h1>
  <p>
    <em>
      Runtime allows you to interact with a wide range of <strong>Chromium-based</strong> browsers, including <strong>Chrome</strong>, <strong>Edge</strong> and soon (Firefox, Brave, Dia, Comet, etc). Our goal is to provide a fast, reliable, and affordable way to work with your office tools and the web. No need to install a separate AI browser to access AI capabilities.
    </em>
  </p>
  <p><em>No vendor lock-in or API dependencies.</em></p>
</div>


<div style="height:4px; background: #3C444D;"></div>
<div style="height: 32px;"></div>

Demo: showing Runtime is 3x faster than Comet. To learn more about our technic, please see our [skills method](/SKILLS.md).
![runtime demo](https://github.com/runtime-org/resources/blob/main/demos/runtime.gif?raw=true)


---
<details> 
<summary> What is our skills method? </summary>

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

A single skills of amazon.* are:

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
</details>


----

### Key Features

- Reliable, hand-crafted action recipes for popular sites (Amazon, Gmail, Google, Notion, and more coming) ensure consistent results
- Actions are performed in your own logged-in browser session—no need for separate profiles or repeated logins
- Research mode: gather, rank, and cite sources efficiently in "tabs" tab.
- Automate multi-step tasks like triaging email, reading and replying to mail.
- Instantly send results to Apple Notes.


---

## What can Runtime do?

#### Search email, reply to an email?
![gmail](https://github.com/runtime-org/resources/blob/main/demos/gmail.gif?raw=true)

#### Search for notion, and summarize the content
![notion](https://github.com/runtime-org/resources/blob/main/demos/notion.gif?raw=true)

#### Do research about vegan restaurant in Berlin
![research](https://github.com/runtime-org/resources/blob/main/demos/research.gif?raw=true)

---

## Quick Start

```bash
# 1. Prerequisites
brew install node rust       # or from nodejs.org & rust-lang.org

# 2. Clone
git clone git@github.com:runtime-org/runtime.git
cd runtime

# 3. Configure (Gemini key)
echo 'VITE_GEMINI_API_KEY=<your-key>' > .env

# 4. Install & run
npm install
npm run tauri dev
```

---
### Contributing

If you want to contribute, you are welcome! Please open an issue or submit a PR if you want us to generate a skills for your website or web app.