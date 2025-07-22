
import { invoke } from "@tauri-apps/api/core";
import { Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";

/*
** extract pdf via tauri
*/
async function extractResourceContent(url: string): Promise<string | null> {
  try {
    return await invoke<string>("download_and_extract_resource", { url });
  } catch (e) {
    console.error("Resource extraction failed:", e);
    return null;
  }
}
/*
** detect pdf
*/
export async function detectPdf(page: Page, url: string): Promise<string | null> {
    /*
    ** quick URL heuristics
    */
    // const url = page.url();
    if (/[?&]format=pdf\b/i.test(url) || url.endsWith(".pdf")) {
      return await extractResourceContent(url);
    }
  
    /*
    ** look at the main-frame response headers
    */
    const response = await page.waitForResponse(
      r => r.url() === url && r.ok(),
      { timeout: 3000 }
    ).catch(() => null);
  
    if (response) {
      const type = response.headers()["content-type"] ?? "";
      if (type.includes("application/pdf")) {
        return await extractResourceContent(url);
      }
    }
  
    /*
    ** look for an <embed> or <iframe> that Chrome uses to show inline PDFs
    */
    const embeddedSrc = await page.evaluate(() => {
      const el =
        document.querySelector<HTMLObjectElement>(
          'embed[type="application/pdf"], iframe[src*=".pdf"], object[type="application/pdf"]'
        );
      return el?.getAttribute("src") ?? null;
    });
  
    if (embeddedSrc) {
      const absolute = new URL(embeddedSrc, url).href;
      return await extractResourceContent(absolute);
    }
  
    return null;
  }
  