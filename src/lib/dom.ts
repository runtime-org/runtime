import { Page } from "puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js";

export class DomService {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

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
            // remove any existing highlights first
            document.querySelectorAll('[data-runtime-highlight]').forEach(el => {
                if (el.getAttribute('data-runtime-highlight')?.startsWith('label-')) {
                    el.remove();
                } else {
                    el.removeAttribute('data-runtime-highlight');
                    (el as HTMLElement).style.removeProperty('outline');
                    (el as HTMLElement).style.removeProperty('outline-offset');
                    (el as HTMLElement).style.removeProperty('box-shadow');
                }
            });

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

            /*
            ** filter out parent elements that contain other interactive elements in order to select leaf elements for an action
            */
           const finalElements = uniqueElements.filter(element => {
                for (const otherEl of uniqueElements) {
                    if (element !== otherEl && (element as HTMLElement).contains(otherEl as HTMLElement)) return false;
                }
                return true;
            });

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

                // add highlighting if requested
                if (opts.highlightElements && isVisible) {
                    element.setAttribute('data-runtime-highlight', index.toString());
                    
                    const isFocused = index === opts.focusElement;
                    const color = isFocused ? '#ff0000' : `hsl(${(index * 137) % 360}, 70%, 50%)`;
                    const outlineWidth = isFocused ? '2px' : '1px';
                    
                    (element as HTMLElement).style.outline = `${outlineWidth} solid ${color}`;
                    (element as HTMLElement).style.outlineOffset = '1px';
                    (element as HTMLElement).style.boxShadow = `0 0 0 1px ${color}`;
                    
                    // add index label with lower z-index to ensure overlay can cover it
                    const label = document.createElement('div');
                    label.textContent = index.toString();
                    label.style.cssText = `
                        position: absolute;
                        top: ${rect.top + window.scrollY - 20}px;
                        left: ${rect.left + window.scrollX}px;
                        background: ${color};
                        color: white;
                        padding: 1px 4px;
                        border-radius: 3px;
                        font-size: 11px;
                        font-weight: bold;
                        z-index: 10000;
                        pointer-events: none;
                        font-family: monospace;
                        line-height: 1;
                        min-width: 16px;
                        text-align: center;
                    `;
                    label.setAttribute('data-runtime-highlight', `label-${index}`);
                    document.body.appendChild(label);
                }

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

    // remove highlights
    async removeHighlights() {
        await this.page.evaluate(() => {
            document.querySelectorAll('[data-runtime-highlight]').forEach(el => {
                if (el.getAttribute('data-runtime-highlight')?.startsWith('label-')) {
                    el.remove();
                } else {
                    el.removeAttribute('data-runtime-highlight');
                    (el as HTMLElement).style.removeProperty('outline');
                    (el as HTMLElement).style.removeProperty('outline-offset');
                    (el as HTMLElement).style.removeProperty('box-shadow');
                }
            });
        });
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

    // get accessibility tree snapshot
    async getAccessibilityTree() {
        try {
            const snapshot = await this.page.accessibility.snapshot({ interestingOnly: true });
            
            const flattenTree = (node: any, depth = 0, result: string[] = []) => {
                if (node.role && node.name) {
                    result.push(`${'  '.repeat(depth)}${node.role} ${node.name}`);
                }
                
                if (node.children) {
                    for (const child of node.children) {
                        flattenTree(child, depth + 1, result);
                    }
                }
                
                return result;
            };

            const lines = flattenTree(snapshot);
            return lines.join('\n');
        } catch (error) {
            return `Error getting accessibility tree: ${error.message}`;
        }
    }

    async getVisibleText(selector = 'body') {
        try {
            const ok = await this.waitUntilBodyNotBlank(10000);
            if (!ok) {
                return { 
                    success: false, 
                    error: 'page did not load any visible text in 10 s', 
                    data: null 
                };
            }
        } catch (err) { }

        const pdf = await this.detectPdf();
        if (pdf) {
            return pdf;
        }

        try {
            const raw = await this.page.$eval(selector, (el: Element) => (el as HTMLElement).innerText);
        
            return raw
            .replace(/\s+\n/g, '\n')    // trailing spaces at line ends
            .replace(/\n{3,}/g, '\n\n') // >2 consecutive blank lines → 1 blank line
            .trim();
        } catch (err) {
        }

        /*
        ** fall back control A, C, control
        */
        try {
            await this.page.keyboard.down("Control");
            await this.page.keyboard.press("KeyA");
            await this.page.keyboard.press("KeyC");
            await this.page.keyboard.up("Control");

            const clipText = await this.page.evaluate(
            () => navigator.clipboard.readText()
            );
            if (clipText.trim().length > 0) {
                return clipText;
            }
        } catch (error) {
            
        }
        return null;
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

    async detectPdf() {
        const url = this.page.url();
        const looksLikePdf  = /\.pdf(\?|$)/i.test(url);
        const contentIsPdf  = await this.page.evaluate(
            () => document.contentType === "application/pdf"
        );

        if (looksLikePdf || contentIsPdf) {
            /* 
            ** try to read the Chrome viewer's text layer 
            */
            try {
              await this.page.waitForSelector("#viewer .textLayer", { timeout: 5_000 });
              const pdfDomText = await this.page.evaluate(() =>
                Array.from(document.querySelectorAll("#viewer .textLayer"))
                  .map(l => (l as HTMLElement).innerText)
                  .join("\n")
              );
              if (pdfDomText.trim().length > 50) {
                return pdfDomText;
              }
            } catch {  }
        }

        return null;
    }
      
}