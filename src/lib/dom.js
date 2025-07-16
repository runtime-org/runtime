
export class DomService {
    constructor(page) {
        this.page = page;
    }

    // get clickable elements with indices
    async getClickableElementsWithIndices(options = {}) {
        const {
            highlightElements = false,
            maxElements = 50,
            includeHidden = false,
            focusElement = -1
        } = options;

        const result = await this.page.evaluate((opts) => {
            // remove any existing highlights first
            document.querySelectorAll('[data-runtime-highlight]').forEach(el => {
                if (el.getAttribute('data-runtime-highlight').startsWith('label-')) {
                    el.remove();
                } else {
                    el.removeAttribute('data-runtime-highlight');
                    el.style.removeProperty('outline');
                    el.style.removeProperty('outline-offset');
                    el.style.removeProperty('box-shadow');
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
                '[data-testid]',
                '.btn:not([disabled])',
                '.button:not([disabled])',
                '[aria-label]:not([aria-disabled="true"])',
                'summary',
                '[tabindex]:not([tabindex="-1"])',
                '[contenteditable="true"]'
            ];

            const elements = [];
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
                        type: element.type || undefined,
                        name: element.name || undefined,
                        href: element.href || undefined,
                        'aria-label': element.getAttribute('aria-label') || undefined,
                        placeholder: element.placeholder || undefined,
                        value: element.value || undefined,
                        role: element.getAttribute('role') || undefined,
                        title: element.title || undefined,
                        'data-testid': element.getAttribute('data-testid') || undefined
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
                    element.setAttribute('data-runtime-highlight', index);
                    
                    const isFocused = index === opts.focusElement;
                    const color = isFocused ? '#ff0000' : `hsl(${(index * 137) % 360}, 70%, 50%)`;
                    const outlineWidth = isFocused ? '2px' : '1px';
                    
                    element.style.outline = `${outlineWidth} solid ${color}`;
                    element.style.outlineOffset = '1px';
                    element.style.boxShadow = `0 0 0 1px ${color}`;
                    
                    // add index label with lower z-index to ensure overlay can cover it
                    const label = document.createElement('div');
                    label.textContent = index;
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
                if (el.getAttribute('data-runtime-highlight').startsWith('label-')) {
                    el.remove();
                } else {
                    el.removeAttribute('data-runtime-highlight');
                    el.style.removeProperty('outline');
                    el.style.removeProperty('outline-offset');
                    el.style.removeProperty('box-shadow');
                }
            });
        });
    }

    // click element by index
    async clickElementByIndex(index, elementMap) {
        if (!elementMap[index]) {
            throw new Error(`Element with index ${index} not found`);
        }

        const element = elementMap[index];
        const xpath = element.xpath;
        
        const result = await this.page.evaluate((xpath, elementInfo) => {
            const element = document.evaluate(
                xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
            ).singleNodeValue;
            
            if (!element) {
                throw new Error('Element not found by XPath');
            }

            // scroll into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            
            // check if it's a file input
            if (element.type === 'file') {
                return { isFileInput: true, message: 'File input detected - use upload_file action instead' };
            }

            // click the element
            element.click();
            
            return { 
                success: true, 
                message: `Clicked element ${elementInfo.index}: ${elementInfo.tagName}${elementInfo.text ? ' - ' + elementInfo.text.substring(0, 50) : ''}` 
            };
        }, xpath, element);

        return result;
    }

    // get accessibility tree snapshot
    async getAccessibilityTree() {
        try {
            const snapshot = await this.page.accessibility.snapshot({ interestingOnly: true });
            
            const flattenTree = (node, depth = 0, result = []) => {
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
            const raw = await this.page.$eval(selector, el => el.innerText);
        
            return raw
            .replace(/\s+\n/g, '\n')    // trailing spaces at line ends
            .replace(/\n{3,}/g, '\n\n') // >2 consecutive blank lines → 1 blank line
            .trim();
        } catch (err) {
            return `Error fetching visible text: ${err.message}`;
        }
    }
}