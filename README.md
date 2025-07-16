# runtime



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
(soon)