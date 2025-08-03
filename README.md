<img src="./public/logo/logo_example.png" alt="Runtime" width="full"/>

<br/>

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)


<!-- ABOUT THE PROJECT -->
## About The Project
Runtime is a game-changer for both personal and professional browsing experiences. This solution provides full control over your browsers based on user queries, enabling information searches and actionable tasks directly within your browser. Additionally, Runtime integrates with note-based apps, ensuring all your important information is automatically organized and accessible.

Key Advantages:
- **Custom Browser Support:** Runtime allows you to use your favorite browsers, eliminating the need to re-login to sites or handle authentication challenges. (Runtime currently supports Google Chrome and Microsoft Edge)
- **Search and Actions:** easily search for information within your chosen browser by following each step of retrieving, and perform actions such as checking emails, adding products to your cart, scheduling meetings on your calendar, and more. (Additional functionalities are planned for future updates.)
- **Integration with Note-Based Apps:** Runtime automatically saves and organizes all retrieved information into your preferred note-based applications. (Runtime is currently compatible with Notion and Mac Notes)


### Demo
<video src="https://github.com/user-attachments/assets/56bc7080-f2e3-4367-af22-6bf2245ff6cb" controls="controls">Your browser does not support playing this video!</video>


<!-- GETTING STARTED -->
## Getting Started




<!-- # runtime



### Get started
The current version is flaky, and we know were the issue is, but working on adressing them actively.

#### Gemini API  Key setup
You should have to create .env file in the root folder, you should add the GEMINI api key as follow
```bash
VITE_GEMINI_API_KEY=
```

#### Setup to run the app (still experimental)
```bash
# install node -> https://formulae.brew.sh/formula/node
# if installed, check via
node -v # depending on your OS, use https://nodejs.org/en

# install rust -> https://www.rust-lang.org/tools/install
# (the above link will install rust compiler for your hardware)
# if installed, check via
rustc -V

# clone the repo and install dependencies
npm install

# run the app in dev mode
npm run tauri dev
```

Current workflow reimplementation (in progress)
 - [x] enhanced query splitter 
 - [x] runWorkflow
 - [x] runSequentialTask
 - [x] planGenerator 
 - [x] planGenerator tested and integrated
 - [x] stepTranslator
 - [x] stepTranslator enhancing
 - [x] handlePuppeteerAction
 - [x] emit progress
 - [ ] test and correction of bugs (ongoing)


```ascii
┌───────────────────────────────────────────────────────────────┐
│                   query.splitter (LLM)                       │
│   User query → SEQUENTIAL SQ0…SQn + dependencies             │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ runWorkflow                                                  │
│ • create one taskId                                          │
│ • call runSequentialTask(queries[])                          │
└───────────────┬──────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│ runSequentialTask                                            │
│ ┌──────── loop SQi ────────┐                                 │
│ │  planGenerator (LLM)     │  -> steps[]                     │
│ │  ┌── loop step_j ─────┐  │                                 │
│ │  │ stepTranslator(LLM)│ →│ toolCall                        │
│ │  │ handlePuppeteer    │ →│ browser action                  │
│ │  └────────────────────┘  │                                 │
│ └──────────────────────────┘                                 │
│ • store outputs in SharedMemory                              │
│ • emit progress to UI                                        │
└───────────────────────────────────────────────────────────────┘

```

```ascii
assistant (toolCall)  ──▶  tool (JSON result)  ──▶  assistant (next toolCall) …
                 ▲                               │
                 ╰───────────── history ─────────╯
```


### Demos
(soon) -->