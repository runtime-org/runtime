import { Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";
import { SkillStep } from "./task.browser.schemas";

type AtomicResult = 
  | { success: true, data: unknown }
  | { success: false, error: string };

const DEFAULT_TIMEOUT = 10_000;

/*
** execute one loàw level browser step using pptr
*/
export async function runAtomicStep(
    { step, page, params }:
    { step: SkillStep, page: Page, params: Record<string, unknown> }
): Promise<AtomicResult> {
    try {
        switch (step.action) {
            /*
            ** click & typing
            */
            case "click": {
                await page.waitForSelector(step.selector!, { timeout: DEFAULT_TIMEOUT });
                await page.click(step.selector!);
                return { success: true, data: null };
            }
            case "type": {
                const text = (params[step.input_key as string] ?? "") as string;
                await page.type(step.selector!, text, { delay: 80 });
                return { success: true, data: null };
            }
            case "press_enter": {
                await page.keyboard.press("Enter");
                return { success: true, data: null };
            }

            /*
            ** waiting
            */
            case "wait_for_selector": {
                await page.waitForSelector(step.selector!, { timeout: DEFAULT_TIMEOUT });
                return { success: true, data: null };
            }

            /*
            ** DOM extraction
            */
            case "extract_list": {
                const items = await page.$$eval(step.selector!, rows =>
                    rows.map(row => {
                      const a = row.querySelector("a");
                      const text = (row as HTMLElement).innerText.trim();
                      return { text, href: a ? (a as HTMLAnchorElement).href : null };
                    })
                );
                return { success: true, data: items };
            }
            case "extract_fields": {
                const fields = await page.$$eval(step.selector!, els =>
                    els.map(el => ({
                        text: (el as HTMLElement).innerText.trim(),
                        html: (el as HTMLElement).innerHTML
                    }))
                );
                return { success: true, data: fields };
            }

            /*
            ** navigation helpers
            */
            case "navigate_back": {
                await page.goBack({ waitUntil: "networkidle2" });
                return { success: true, data: null };
            }
            case "click_element_by_index": {
                const idx = (step.index ?? params.index) as number;
                const nodes = await page.$$(step.selector!);
                if (!nodes[idx]) throw new Error(`Index ${idx} out of range`);
                await nodes[idx].click();
                return { success: true, data: null };
            }

            /*
            ** navigate to url
            */
            case "navigate_to_url": {
                await page.goto(step.url!, { waitUntil: "networkidle2", timeout: DEFAULT_TIMEOUT });
                return { success: true, data: null };
            }

            default: {
                throw new Error(`Unknown action: ${step.action}`);
            }
        }
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}