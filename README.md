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

<div align="center">
  <video src="https://github.com/runtime-org/resources/raw/refs/heads/main/demos/runtime.mp4" controls width="90%">
    Your browser does not support playing this video.
  </video>
</div>


---

## Why Runtime?

* **Deterministic Skills** – Hand-crafted action recipes for popular sites (Amazon, Gmail, Google, Notion, …) give repeatable and reliable outcomes.  
* **Your Session, Your Browser** – Human-like actions run in *your* logged-in session; no separate profile or re-authentication hoops.
* **Two Modes**  
  * **Research** – Gather, rank and cite sources.  
  * **Browse** – Execute multi-step tasks (triage email, fill carts, schedule meetings, etc.).  
* **One-Click Export** – Ship everything straight to Notion or Apple Notes.  
* **Open Ecosystem** – Build your own skills; we provide a lightweight SDK.

> **TL;DR:** Keep your current workflow, gain an LLM side-kick that acts predictably.

---

## What can Runtime do?

### 1️⃣ “Can Runtime summarise a long article for me?”
<video src="https://github.com/user-attachments/assets/demo-summary.mp4" controls>
  Your browser does not support playing this video.
</video>

---

### 2️⃣ “Can it auto-fill checkout on Amazon?”
<video src="https://github.com/user-attachments/assets/demo-amazon.mp4" controls>
  Your browser does not support playing this video.
</video>

---

### 3️⃣ “Can it triage my Gmail inbox?”
<video src="https://github.com/user-attachments/assets/demo-gmail.mp4" controls>
  Your browser does not support playing this video.
</video>

---

### 4️⃣ “Can I export findings to Notion in one click?”
<video src="https://github.com/user-attachments/assets/demo-notion.mp4" controls>
  Your browser does not support playing this video.
</video>

---

## Quick Start

```bash
# 1. Prerequisites
brew install node rust       # or grab installers from nodejs.org & rust-lang.org
node -v && rustc -V          # verify installs

# 2. Clone
git clone git@github.com:runtime-org/runtime.git
cd runtime

# 3. Configure (Gemini key)
echo 'VITE_GEMINI_API_KEY=<your-key>' > .env

# 4. Install & run
npm install
npm run tauri dev
