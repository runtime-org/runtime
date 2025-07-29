import { Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";
import { detectPdf } from "./dom.utils";

const MESH_ID   = '__rt_mesh_overlay__';
const STYLE_ID  = '__rt_mesh_overlay_style__';
const FLAG = '__rt_mesh_installed__' as const;;

export class DomService {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // legacy
    // get clickable elements with indices
    async getClickableElementsWithIndices(options: {
        highlightElements?: boolean;
        maxElements?: number;
        includeHidden?: boolean;
        focusElement?: number;
    } = {}) {
        const {
            highlightElements = false,
            maxElements = 50,
            includeHidden = false,
            focusElement = -1
        } = options;

        const result = await this.page.evaluate((opts) => {

            // define clickable selectors
            const clickableSelectors = [
                'a[href]:not([href=""])',
                'button:not([disabled])',
                'input:not([type="hidden"]):not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[role="button"]:not([aria-disabled="true"])',
                '[role="link"]',
                '[role="menuitem"]',
                '[role="tab"]',
                '[role="checkbox"]',
                '[role="radio"]',
                '[onclick]',
                '[jsaction*="click:"]',
                '[data-testid]',
                '.btn:not([disabled])',
                '.button:not([disabled])',
                '[aria-label]:not([aria-disabled="true"])',
                'summary',
                '[tabindex]:not([tabindex="-1"])',
                '[contenteditable="true"]'
            ];

            const elements: Element[] = [];
            clickableSelectors.forEach(selector => {
                try {
                    elements.push(...Array.from(document.querySelectorAll(selector)));
                } catch (e) {
                    console.warn('Invalid selector:', selector, e);
                }
            });

            // remove duplicates
            const uniqueElements = [...new Set(elements)];

            const elementMap = {};
            let index = 0;

            uniqueElements.forEach((element) => {
                if (index >= opts.maxElements) return;

                // check if element is visible and interactable
                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                
                const isVisible = rect.width > 0 && 
                                rect.height > 0 && 
                                style.visibility !== 'hidden' && 
                                style.display !== 'none' &&
                                style.opacity !== '0';

                const isInViewport = rect.top >= 0 && 
                                   rect.left >= 0 && 
                                   rect.bottom <= window.innerHeight && 
                                   rect.right <= window.innerWidth;

                if (!isVisible && !opts.includeHidden) return;

                // generate XPath
                function getXPath(element) {
                    if (element.id !== '') {
                        return `//*[@id="${element.id}"]`;
                    }
                    if (element === document.body) {
                        return '/html/body';
                    }
                    
                    let ix = 0;
                    const siblings = element.parentNode ? element.parentNode.childNodes : [];
                    for (let i = 0; i < siblings.length; i++) {
                        const sibling = siblings[i];
                        if (sibling === element) {
                            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
                        }
                        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                            ix++;
                        }
                    }
                }

                // get all text content for context
                const getAllText = (el) => {
                    let text = '';
                    if (el.nodeType === Node.TEXT_NODE) {
                        return el.textContent.trim();
                    }
                    for (let child of el.childNodes) {
                        if (child.nodeType === Node.TEXT_NODE) {
                            text += child.textContent.trim() + ' ';
                        } else if (child.nodeType === Node.ELEMENT_NODE && 
                                 !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(child.tagName)) {
                            const childText = getAllText(child);
                            if (childText && text.length < 200) {
                                text += childText + ' ';
                            }
                        }
                    }
                    return text.trim();
                };

                const elementInfo = {
                    index,
                    tagName: element.tagName.toLowerCase(),
                    text: getAllText(element).substring(0, 150) || '',
                    attributes: {
                        id: element.id || undefined,
                        class: element.className || undefined,
                        type: (element as HTMLInputElement).type || undefined,
                        name: (element as HTMLInputElement).name || undefined,
                        href: (element as HTMLAnchorElement).href || undefined,
                        'aria-label': element.getAttribute('aria-label') || undefined,
                        placeholder: (element as HTMLInputElement).placeholder || undefined,
                        value: (element as HTMLInputElement).value || undefined,
                        role: element.getAttribute('role') || undefined,
                        title: (element as HTMLElement).title || undefined,
                        'data-testid': element.getAttribute('data-testid') || undefined,
                        'jsaction': element.getAttribute('jsaction') || undefined
                    },
                    rect: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        top: Math.round(rect.top),
                        left: Math.round(rect.left),
                        bottom: Math.round(rect.bottom),
                        right: Math.round(rect.right)
                    },
                    xpath: getXPath(element),
                    isVisible,
                    isInViewport
                };

                // clean up attributes (remove undefined values)
                Object.keys(elementInfo.attributes).forEach(key => {
                    if (elementInfo.attributes[key] === undefined || elementInfo.attributes[key] === '') {
                        delete elementInfo.attributes[key];
                    }
                });

                elementMap[index] = elementInfo;

                index++;
            });

            return {
                elementMap,
                totalElements: index,
                viewportInfo: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    scrollX: window.scrollX,
                    scrollY: window.scrollY
                },
                pageInfo: {
                    title: document.title,
                    url: window.location.href,
                    readyState: document.readyState,
                    scrollHeight: document.documentElement.scrollHeight,
                    scrollTop: window.pageYOffset || document.documentElement.scrollTop
                }
            };
        }, { highlightElements, maxElements, includeHidden, focusElement });

        return result;
    }

    // click element by index
    async clickElementByIndex(index: number, elementMap: Record<number, any>) {
        if (!elementMap[index]) {
            throw new Error(`Element with index ${index} not found`);
        }

        const element = elementMap[index];
        const xpath = element.xpath;
        
        const clickAndNav = Promise.allSettled([
            this.page.waitForNavigation({
                waitUntil: 'domcontentloaded',
                timeout: 10000
            }),
            this.page.evaluate((xp) => {
                const element = document.evaluate(
                    xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue as HTMLElement | null;
                
                if (!element) {
                    throw new Error('Element not found by XPath');
                }

                (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                
                if ((element as HTMLInputElement).type === 'file') {
                    return { isFileInput: true, message: 'File input detected - use upload_file' };
                }

                (element as HTMLElement).click();
                return { clicked: true };
            }, xpath)
        ]);

        const [navRes, clickRes] = await clickAndNav;

        if ((clickRes as PromiseFulfilledResult<any>).value?.isFileInput) {
            return { isFileInput: true, message: 'File input detected - use upload_file action instead' };
        }

        if (navRes.status === 'rejected') {
            return { success: true, message: `Clicked element ${index} (no nav)` };
        }

        return { success: true, message: `Clicked element ${index} and navigated` };
    }

    // new
    async clickElement({targetIndex, elements}: { targetIndex: number, elements: any[]}) {
        const elInfo = elements.find(e => e.index === targetIndex);
        if (!elInfo) throw new Error(`Element with index ${targetIndex} not found`);
      
        const [nav, click] = await Promise.allSettled([
          this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10_000 }),
          this.page.evaluate(xp => {
            const node = document.evaluate(
              xp,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue as HTMLElement | null;
      
            if (!node) throw new Error('Element not found by XPath');
      
            node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      
            if ((node as HTMLInputElement).type === 'file') {
              return { isFileInput: true };
            }
      
            node.click();
            return { clicked: true };
          }, elInfo.xpath)
        ]);
      
        // special case: <input type="file">
        if ((click as PromiseFulfilledResult<any>).value?.isFileInput) {
          return { isFileInput: true, message: 'File input detected - use upload_file instead' };
        }
      
        // navigation is optional
        if (nav.status === 'rejected') {
          return { success: true, message: `Clicked element ${targetIndex} (no navigation)` };
        }
      
        return { success: true, message: `Clicked element ${targetIndex} and navigated` };
    }

    // new
    async collectIntertiveElements() {
        return await this.page.evaluate(() => {
            const gather = (root: ParentNode, out: HTMLElement[] = []) => {
                const sel = [
                'a[href]:not([href=""])',
                'button:not([disabled])',
                'input:not([type=hidden]):not([disabled])',
                'textarea:not([disabled])',
                'select:not([disabled])',
                '[role="button"]',
                '[role="link"]',
                '[role="textbox"]',
                '[role="checkbox"]',
                ].join(',');
                root.querySelectorAll<HTMLElement>(sel).forEach(el => {
                /* skip container elements that contain another candidate */
                if (![...el.querySelectorAll(sel)].some(c => c !== el)) out.push(el);
                });
        
                /* dive into any open shadow roots */
                (root as any).querySelectorAll?.('*')?.forEach((n: any) => {
                if (n.shadowRoot) gather(n.shadowRoot, out);
                });
                return out;
            };
            
            const trim = (t: string | null) => (t && t.trim() ? t.trim() : undefined);

            /* use the ARIA algorithm to approximate accessible-name */
            const accName = (el: HTMLElement) => {
                const lbl = (el as any).ariaLabel || el.getAttribute?.('aria-label');
                if (lbl) return trim(lbl);

                const labelledBy = el.getAttribute?.('aria-labelledby');
                if (labelledBy) {
                    const txt = labelledBy
                                .split(/\s+/)
                                .map(id => document.getElementById(id)?.textContent ?? '')
                                .join(' ')
                    return trim(txt);
                }
                    
                return (
                    trim(el.getAttribute?.('title')) ||
                    trim((el as HTMLInputElement).placeholder) ||
                    trim(el.textContent)
                )
            };

            const buildXPath = (el: Element): string => {
                if (el.id) return `//*[@id="${el.id}"]`;
                if (el === document.body) return '/html/body';
                const sameTagSiblings = Array.from(el.parentNode!.children).filter(
                sib => sib.tagName === el.tagName
                );
                const idx = sameTagSiblings.indexOf(el) + 1;
                return buildXPath(el.parentNode as Element) + '/' + el.tagName.toLowerCase() + `[${idx}]`;
            };

            const result: any[] = [];
            const leaves = gather(document);

            leaves.forEach((el, i) => {
                const name = accName(el);
                if (!name) return;

                result.push({
                    index : i,
                    tag   : el.tagName.toLowerCase(),
                    accessibleName : name,
                    href : el.tagName.toLowerCase() === 'a' ? (el as HTMLAnchorElement).href : "",
                    xpath : buildXPath(el)
                })
            })

            return result;
        })
    }

    // new
    async typeTextByIndex(
        targetIndex: number,
        elements: Array<{ index: number; xpath: string }>,
        text: string
      ) {
        const elInfo = elements.find(e => e.index === targetIndex);
        if (!elInfo) throw new Error(`Element with index ${targetIndex} not found`);
      
        return await this.page.evaluate(
          (xp, value) => {
            const node = document.evaluate(
              xp,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue as HTMLElement | null;
      
            if (!node) throw new Error('Input element not found');
      
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            node.focus();
      
            if ('value' in node) {
              (node as HTMLInputElement | HTMLTextAreaElement).value = value;
            } else {
              node.textContent = value;           // contenteditable, etc.
            }
      
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, inputText: value };
          },
          elInfo.xpath,
          text
        );
    }

    // new
    async getInteractiveElements() {
        const list = await this.collectIntertiveElements();
        return list.slice(0, 10000);
    }



    async getVisibleText(selector = 'body') {
        try {
            const ok = await this.waitUntilBodyNotBlank(7_000);
            if (!ok) {
                return { 
                    success: false, 
                    error: 'page did not load any visible text in 7 s', 
                    data: null 
                };
            }
        } catch (err) { }

        const pdfText = await detectPdf(this.page, this.page.url());
        if (pdfText) {
            return pdfText;
        }

        /*
        ** regular dom text
        */
        try {
            const raw = await this.page.$eval(
                selector, 
                (el: Element) => (el as HTMLElement).innerText);
        
            return raw
            .replace(/\s+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        } catch (_) {
            return null;
        }
    }

    async waitUntilBodyNotBlank(maxMs = 10000, poll = 250): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
          const hasText = await this.page.evaluate(() =>
            !!document.body && document.body.innerText.trim().length > 0
          );
          if (hasText) return true;
          await new Promise(r => setTimeout(r, poll));
        }
        return false;
    }

    installScript = `
(() => {
  if (window['${FLAG}']) return;
  window['${FLAG}'] = true;

  function init(){
    if (!document.body) return;        // should never happen, but safe-guard
    /* ---------- style block ---------- */
    if (!document.getElementById('${STYLE_ID}')) {
      const s = document.createElement('style');
      s.id='${STYLE_ID}';
      s.textContent = \`
#${MESH_ID}{position:fixed;inset:0;pointer-events:none;z-index:999999;background:transparent}
#${MESH_ID}::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:
    linear-gradient( 90deg,#1e90ff 0%,transparent 70%) top    /100% 16px,
    linear-gradient(180deg,#1e90ff 0%,transparent 70%) right  /16px 100%,
    linear-gradient(-90deg,#1e90ff 0%,transparent 70%) bottom /100% 16px,
    linear-gradient(-180deg,#1e90ff 0%,transparent 70%) left  /16px 100%;
  background-repeat:no-repeat;
  filter:blur(8px);opacity:.75;
  animation:rtMesh 3s linear infinite;
}
@keyframes rtMesh{
  0%{transform:scale(1)}
  50%{transform:scale(1.08)}
  100%{transform:scale(1)}
}\`;
      document.head.appendChild(s);
    }
    /* ---------- mesh element ---------- */
    if (!document.getElementById('${MESH_ID}')) {
      const d = document.createElement('div');
      d.id='${MESH_ID}';
      document.body.appendChild(d);
    }
  } /* end init */

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();`;


    async showMeshOverlay(page: Page) {
        await page.evaluateOnNewDocument(this.installScript);

        /* 
        ** also inject into the *current* document so the user sees it immediately 
        */
        await page.evaluate(this.installScript);
    }
      

    async hideMeshOverlay(page: Page) {
        /* 
        ** remove element + style from the live document
        */
        await page.evaluate((meshId, styleId) => {
          document.getElementById(meshId)?.remove();
          document.getElementById(styleId)?.remove();
        }, MESH_ID, STYLE_ID);
      
        /* 
        ** remove the flag so future navigations don't recreate it
        */
        await page.evaluateOnNewDocument(`
          delete window['${FLAG}'];
        `);
    }
      
      
}