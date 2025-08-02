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
            ** scroll
            */
            case "scroll_down": {
                const times = (step.times ?? 8); // times is basically 1 -> 0.25. to scroll 3 times, we need 12
                for (let i = 0; i < times; i++) {
                    await page.evaluate(
                        () => window.scrollBy({
                            top: window.innerHeight * 0.25,
                            left: 0,
                            behavior: 'smooth'
                        })
                    );
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
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
                const { selector, schema } = step;
                console.log("+++++>", selector, schema);
              
                const rows = await page.$$eval(selector!, (nodes, schema) => {
                  return nodes.map((n: Element, idx: number) => {
                    const out: Record<string, unknown> = { index: idx };
                    for (const [key, rule] of Object.entries(schema as Record<string, string>)) {
                      if (rule.startsWith("@")) {
                        out[key] = n.getAttribute(rule.slice(1));
                      } else if (rule.endsWith("::href")) {
                        const sub = n.querySelector(rule.replace("::href", ""));
                        out[key] = sub ? (sub as HTMLAnchorElement).href : null;
                      } else if (rule.endsWith("::text")) {
                        const sub = n.querySelector(rule.replace("::text", ""));
                        out[key] = sub ? sub.textContent?.trim() : null;
                      } else if (rule.endsWith("::self")) {
                        out[key] = rule.replace("::self", "").replace("%asin%", n.getAttribute("data-asin") || "");
                      } else {
                        const sub = n.querySelector(rule);
                        out[key] = sub ? sub.textContent?.trim() : null;
                      }
                    }
                    return out;
                  });
                }, schema);
              
                return { success: true, data: rows };
            }
            
            case "extract_fields": {
                const raw = step.selector!;
                const selectors = raw.split(",").map(s => s.trim()).filter(Boolean);
                
                const pieces = await page.evaluate((sels) => {
                    return sels.map(sel => {
                        const el = document.querySelector(sel);
                        return el ? (el as HTMLElement).innerText.trim() : "";
                    });
                }, selectors);

                const text = pieces
                    .filter(Boolean)
                    .map(t => t.replace(/\s+/g, " "))
                    .join(" | ")
                return { success: true, data: text };
            }

            /*
            ** navigation helpers
            */
            case "navigate_back": {
                await page.goBack({ waitUntil: "networkidle2" });
                return { success: true, data: null };
            }
            case "navigate_to_url": {
                const url = params.url_override || step.url;    
                await page.goto(url as string, { waitUntil: "networkidle2", timeout: DEFAULT_TIMEOUT });
                return { success: true, data: null };
            }
            case "click_element_by_index": {
                const sel = params.selector_override || step.selector;
                const idx = params.number ?? step.index ?? 0;
              
                await page.evaluate(({ sel, idx }) => {
                  const nodes = Array.from(document.querySelectorAll(sel as string));
                  if (!nodes[idx as number]) throw new Error(`Index ${idx} out of range`);
                  (nodes[idx as number] as HTMLElement).scrollIntoView({ block: "center" });
                  (nodes[idx as number] as HTMLElement).click();
                }, { sel, idx });
              
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