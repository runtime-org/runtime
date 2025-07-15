# runtime

Setup to run the app (still experimental)
```bash
# install node -> https://formulae.brew.sh/formula/node
# if installed, check via
node -v

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
 - [ ] runSequentialTask
 - [x] planGenerator 
 - [x] planGenerator tested and integrated
 - [x] stepTranslator
 - [ ] stepTranslator enhancing
 - [x] handlePuppeteerAction
 - [ ] emit progress
 - [ ] test and integration


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
