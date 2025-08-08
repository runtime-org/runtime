import puppeteer from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";
import { Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";
import { useAppState } from "../hooks/useAppState";
import { invoke } from "@tauri-apps/api/core";

/*
** simple in-memory tab registry backed by current puppeteer browserInstance
*/
export const tabRegistry = {
  _list: [],
  _reconnecting: false as boolean,
  _lastRefreshTime: 0 as number,

  async refresh() {
    try {
      const {
        browserInstance,
        currentBrowserPath,
        getWsFor,
        setBrowserInstance,
        setIsConnected,
        forgetBrowser
      } = useAppState.getState();

      let browser = browserInstance;

      // throttle reconnection attempts
      const now = Date.now();
      if (!browser && (now - this._lastRefreshTime) < 2000) {
        // don't try to reconnect more than once every 2 seconds
        return;
      }
      this._lastRefreshTime = now;

      // if no browser instance and not already reconnecting
      if (!browser && !_safeBool(this._reconnecting)) {
        const ws = typeof getWsFor === "function" ? getWsFor(currentBrowserPath) : null;

        if (!ws) {
          this._list = [];
          return;
        }

        this._reconnecting = true;
        try {
          // validate WS with backend first
          await invoke("validate_ws_endpoint", {
            wsEndpoint: ws,
            selectedBrowserPath: currentBrowserPath
          });

          browser = await puppeteer.connect({
            browserWSEndpoint: ws,
            defaultViewport: null
          });
          
          if (browser) {
            setBrowserInstance?.(browser);
            setIsConnected?.(true);
            console.log("Tab registry successfully reconnected to browser");
          }
        } catch (err) {
          console.log("Tab registry: Failed to connect -", (err as Error).message);
          // don't clear the WS endpoint here, let App.jsx handle it
          this._list = [];
          return;
        } finally {
          this._reconnecting = false;
        }
      }

      // If still no browser, clear the list and return
      if (!browser) {
        this._list = [];
        return;
      }

      // check if browser is still connected
      try {
        const pages = await browser.pages();
        const items = await Promise.all(
          pages.map(async (p: Page, idx: number) => {
            let title = "";
            let url = "";
            try { title = await p.title(); } catch {}
            try { url = p.url(); } catch {}

            const cleanTitle = title || url || `Tab ${idx + 1}`;
            return { title: cleanTitle, url, page: p };
          })
        );

        // ignore about:blank tabs
        const cleaned = items.filter(it => it.url !== "about:blank");

        // de-duplicate by url (best-effort)
        const seen = new Set();
        this._list = cleaned.filter(it => {
          if (!it.url) return true;
          if (seen.has(it.url)) return false;
          seen.add(it.url);
          return true;
        });
      } catch (error) {
        console.error("Failed to get pages from browser:", error);
        this._list = [];
        // don't trigger reconnection here, let App.jsx handle it
      }
    } catch (error) {
      console.error("Tab registry refresh error:", error);
      this._list = [];
    }
  },

  findByPrefix(prefix: string) {
    const q = (prefix || "").toLowerCase();
    return this._list
      .filter((t: any) =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.url && t.url.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }
};

function _safeBool(v: unknown): v is boolean {
  return typeof v === "boolean" && v;
}