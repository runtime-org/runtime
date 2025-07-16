import { DomService } from './dom';

export const handlePuppeteerAction = async ({actionDetails, browserInstance, currentPage, logged = false}) => {
    // eslint-disable-next-line no-unused-vars
    const { action, parameters, taskId } = actionDetails;
    const pageInstance = currentPage;

    const domService = new DomService(pageInstance);

    let result = { success: false, error: "Action not implemented", data: null };

    try {
        switch (action) {
            // ===== TASK COMPLETION =====
            case "done":
                result = { 
                    success: true, 
                    data: { 
                        taskComplete: true, 
                        success: parameters.success,
                        message: parameters.text 
                    } 
                };
                break;

            // ===== NAVIGATION =====
            case "search_google": {
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(parameters.query)}&udm=14`;
                await pageInstance.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                result = { success: true, data: { searchQuery: parameters.query, navigatedTo: searchUrl } };
                if (logged) console.log(`🔍 Searched for "${parameters.query}" in Google`);
                break;
            }

            case "go_to_url": {
                await pageInstance.goto(parameters.url, { waitUntil: 'networkidle0', timeout: 60000 });
                result = { success: true, data: { navigatedTo: parameters.url } };
                if (logged) console.log(`🔗 Navigated to ${parameters.url}`);
                break;
            }

            case "go_back": {
                await pageInstance.goBack({ waitUntil: 'networkidle0' });
                result = { success: true, data: { action: 'navigated back' } };
                if (logged) console.log("🔙 Navigated back");
                break;
            }

            case "go_forward": {
                await pageInstance.goForward({ waitUntil: 'networkidle0' });
                result = { success: true, data: { action: 'navigated forward' } };
                if (logged) console.log("⏭️ Navigated forward");
                break;
            }
            case "refresh_page": {
                await pageInstance.reload({ waitUntil: 'networkidle0' });
                result = { success: true, data: { action: 'page refreshed' } };
                if (logged) console.log("🔄 Page refreshed");
                break;
            }
            // ===== TIMING =====
            case "wait": {
                const waitTime = parameters.seconds || 3;
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                result = { success: true, data: { waited: waitTime } };
                if (logged) console.log(`🕒 Waited for ${waitTime} seconds`);
                break;
            }
            // ===== ELEMENT INTERACTION =====
            case "click_element_by_index": {
                const clickableElements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                const clickResult = await domService.clickElementByIndex(parameters.index, clickableElements.elementMap);
                
                if (clickResult.isFileInput) {
                    result = { success: false, error: clickResult.message, data: null };
                } else {
                    result = { success: true, data: clickResult };
                    if (logged) console.log(`🖱️ ${clickResult.message}`);
                }
                break;
            } 
            case "input_text": {
                const inputElements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                if (!inputElements.elementMap[parameters.index]) {
                    throw new Error(`Element with index ${parameters.index} not found`);
                }

                const inputElement = inputElements.elementMap[parameters.index];
                const inputResult = await pageInstance.evaluate((xpath, text) => {
                    const element = document.evaluate(
                        xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                    ).singleNodeValue;
                    
                    if (!element) {
                        throw new Error('Input element not found');
                    }

                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.focus();
                    element.value = text;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    return { success: true, inputText: text };
                }, inputElement.xpath, parameters.text);

                result = { success: true, data: inputResult };
                if (logged) console.log(`⌨️ Input text into element ${parameters.index}`);
                break;
            }
            case "send_keys": {
                await pageInstance.keyboard.press(parameters.keys);
                result = { success: true, data: { keys: parameters.keys } };
                if (logged) console.log(`⌨️ Sent keys: ${parameters.keys}`);
                break;
            }
            // ===== SCROLLING =====
            case "scroll_down": {
                const scrollDownAmount = parameters.amount || await pageInstance.evaluate(() => window.innerHeight);
                await pageInstance.evaluate((amount) => {
                    window.scrollBy(0, amount);
                }, scrollDownAmount);
                    result = { success: true, data: { scrolled: scrollDownAmount } };
                    if (logged) console.log(`🔍 Scrolled down ${scrollDownAmount}px`);
                break;
            }

            case "scroll_up": {
                const scrollUpAmount = parameters.amount || await pageInstance.evaluate(() => window.innerHeight);
                await pageInstance.evaluate((amount) => {
                    window.scrollBy(0, -amount);
                }, scrollUpAmount);
                result = { success: true, data: { scrolled: -scrollUpAmount } };
                if (logged) console.log(`🔍 Scrolled up ${scrollUpAmount}px`);
                break;
            }

            case "scroll_to_text": {
                const scrollResult = await pageInstance.evaluate((text) => {
                    const xpath = `//*[contains(text(), "${text}")]`;
                    const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return { found: true, text };
                    }
                    return { found: false, text };
                }, parameters.text);

                result = { 
                    success: scrollResult.found, 
                    data: scrollResult,
                    error: scrollResult.found ? null : `Text "${parameters.text}" not found on page`
                };
                if (logged) console.log(`🔍 ${scrollResult.found ? 'Scrolled to' : 'Could not find'} text: ${parameters.text}`);
                break;
            }

            // ===== DROPDOWN OPERATIONS =====
            case "get_dropdown_options": {
                const dropdownElements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                const dropdown = dropdownElements.elementMap[parameters.index];
                
                if (!dropdown || dropdown.tagName !== 'select') {
                    throw new Error(`Element at index ${parameters.index} is not a select dropdown`);
                }

                const options = await pageInstance.evaluate((xpath) => {
                    const select = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (!select) return [];
                    
                    return Array.from(select.options).map((opt, index) => ({
                        index,
                        text: opt.text,
                        value: opt.value
                    }));
                }, dropdown.xpath);

                result = { success: true, data: { options } };
                if (logged) console.log(`📋 Found ${options.length} options in dropdown`);
                break;
            }

            case "select_dropdown_option": {
                const selectElements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                const selectElement = selectElements.elementMap[parameters.index];
                
                if (!selectElement || selectElement.tagName !== 'select') {
                    throw new Error(`Element at index ${parameters.index} is not a select dropdown`);
                }

                const selectResult = await pageInstance.evaluate((xpath, optionText) => {
                    const select = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (!select) throw new Error('Select element not found');
                    
                    const option = Array.from(select.options).find(opt => opt.text === optionText);
                    if (!option) {
                        return { success: false, error: `Option "${optionText}" not found` };
                    }
                    
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, selectedText: optionText, selectedValue: option.value };
                }, selectElement.xpath, parameters.text);

                result = selectResult;
                if (logged) console.log(`📋 Selected option: ${parameters.text}`);
                break;
            }

            // ===== DRAG AND DROP =====
            case "drag_drop": {
                let sourceX, sourceY, targetX, targetY;
                
                if (parameters.source_index !== undefined) {
                    const elements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                    const sourceEl = elements.elementMap[parameters.source_index];
                    if (!sourceEl) throw new Error(`Source element ${parameters.source_index} not found`);
                    sourceX = sourceEl.rect.x + sourceEl.rect.width / 2;
                    sourceY = sourceEl.rect.y + sourceEl.rect.height / 2;
                } else {
                    sourceX = parameters.source_x;
                    sourceY = parameters.source_y;
                }

                if (parameters.target_index !== undefined) {
                    const elements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                    const targetEl = elements.elementMap[parameters.target_index];
                    if (!targetEl) throw new Error(`Target element ${parameters.target_index} not found`);
                    targetX = targetEl.rect.x + targetEl.rect.width / 2;
                    targetY = targetEl.rect.y + targetEl.rect.height / 2;
                } else {
                    targetX = parameters.target_x;
                    targetY = parameters.target_y;
                }

                await pageInstance.mouse.move(sourceX, sourceY);
                await pageInstance.mouse.down();
                
                const steps = parameters.steps || 10;
                const delay = parameters.delay_ms || 50;
                
                for (let i = 0; i <= steps; i++) {
                    const x = sourceX + (targetX - sourceX) * (i / steps);
                    const y = sourceY + (targetY - sourceY) * (i / steps);
                    await pageInstance.mouse.move(x, y);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                await pageInstance.mouse.up();
                
                result = { success: true, data: { draggedFrom: { x: sourceX, y: sourceY }, draggedTo: { x: targetX, y: targetY } } };
                if (logged) console.log(`🫳 Drag and drop completed`);
                break;
            }

            // ===== TAB MANAGEMENT =====
            case "switch_tab": {
                if (!browserInstance) throw new Error("Browser instance not available");
                const pages = await browserInstance.pages();
                const targetPage = pages[parameters.page_id];
                if (!targetPage) throw new Error(`Tab ${parameters.page_id} not found`);
                
                await targetPage.bringToFront();
                result = { success: true, data: { switchedTo: parameters.page_id, url: targetPage.url() } };
                if (logged) console.log(`🔄 Switched to tab ${parameters.page_id}`);
                break;
            }

            case "open_tab": {
                if (!browserInstance) throw new Error("Browser instance not available");
                const newPage = await browserInstance.newPage();
                await newPage.goto(parameters.url, { waitUntil: 'networkidle0' });
                const pages2 = await browserInstance.pages();
                const newTabIndex = pages2.length - 1;
                
                result = { success: true, data: { newTabIndex, url: parameters.url } };
                if (logged) console.log(`🔗 Opened new tab with ${parameters.url}`);
                break;
            }

            case "get_all_tabs": {
                if (!browserInstance) throw new Error("Browser instance not available");
                const allPages = await browserInstance.pages();
                const tabs = allPages.map((p, i) => ({ id: i, url: p.url(), title: p.title() ? p.title() : "" }));
                result = { success: true, data: { tabs } };
                if (logged) console.log(`🔗 Retrieved all tabs`);
                break;
            }

            case "get_current_tab": {
                if (!browserInstance) throw new Error("Browser instance not available");
                const for_pages = await browserInstance.pages();
                const currentTab = for_pages.findIndex(p => p === pageInstance);
                result = { success: true, data: { currentTab } };
                if (logged) console.log(`🔗 Retrieved current tab`);
                break;
            }

            case "close_tab": {
                if (!browserInstance) throw new Error("Browser instance not available");
                const pagesBeforeClose = await browserInstance.pages();
                const pageToClose = pagesBeforeClose[parameters.page_id];
                if (!pageToClose) throw new Error(`Tab ${parameters.page_id} not found`);
                
                await pageToClose.close();
                result = { success: true, data: { closedTab: parameters.page_id } };
                if (logged) console.log(`❌ Closed tab ${parameters.page_id}`);
                break;
            }

            // ===== CONTENT EXTRACTION =====
            case "extract_content": {
                const extractedContent = await pageInstance.evaluate((goal, includeLinks) => {
                    // Get page content
                    const textContent = document.body.innerText || '';
                    let links = [];
                    
                    if (includeLinks) {
                        links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
                            text: a.innerText?.trim() || a.textContent?.trim(),
                            href: a.href,
                            title: a.title
                        })).filter(link => link.text && link.href);
                    }

                    // Simple content extraction based on goal
                    const goalLower = goal.toLowerCase();
                    let relevantContent = textContent;
                    
                    // Try to find content related to the goal
                    if (goalLower.includes('price') || goalLower.includes('cost')) {
                        const priceRegex = /[$£€¥][\d,]+\.?\d*/g;
                        const prices = textContent.match(priceRegex) || [];
                        if (prices.length > 0) {
                            relevantContent = `Found prices: ${prices.join(', ')}\n\n${textContent.substring(0, 2000)}`;
                        }
                    }

                    return {
                        goal,
                        content: relevantContent.substring(0, 5000),
                        links: links.slice(0, 20),
                        extractedAt: new Date().toISOString(),
                        url: window.location.href,
                        title: document.title
                    };
                }, parameters.goal, parameters.include_links || false);

                result = { success: true, data: extractedContent };
                if (logged) console.log(`📄 Extracted content for: ${parameters.goal}`);
                break;
            }

            case "get_visible_text": {
                const visibleText = await domService.getVisibleText();
                result = { success: true, data: { visibleText } };
                if (logged) console.log(`🔍 Retrieved visible text`);
                break;
            }

            // ===== PAGE STATE =====
            case "get_simplified_page_context": {
                let screenshot = null;
                let browserState;

                try {
                    // apply highlights
                    browserState = await domService.getClickableElementsWithIndices({
                        highlightElements: true,
                        maxElements: parameters.max_elements || 50,
                        focusElement: parameters.focus_element_for_screenshot
                    });
                    // highlights are now on the page with z-index: 10000

                    if (parameters.include_screenshot) {
                        // take screenshot
                        // eslint-disable-next-line no-unused-vars
                        screenshot = await pageInstance.screenshot({
                            encoding: 'base64',
                            fullPage: false // only the viewport
                        });
                    }
                } finally {
                    // remove highlights after the delay
                    await domService.removeHighlights();
                }

                // if browserState was not populated due to an error before its assignment
                if (!browserState) {
                    // fallback: get elements without highlighting if the primary path failed
                    browserState = await domService.getClickableElementsWithIndices({
                        highlightElements: false,
                        maxElements: parameters.max_elements || 50
                    });
                }

                const rawContext = {
                    url: browserState.pageInfo.url,
                    title: browserState.pageInfo.title,
                    screenshot: null,
                    // screenshot: screenshot,
                    interactiveElements: Object.entries(browserState.elementMap).map(([index, element]) => ({
                        index: parseInt(index),
                        tag: element.tagName,
                        text: element.text,
                        attributes: element.attributes,
                        // rect: element.rect,
                        // isVisible: element.isVisible,
                        // isInViewport: element.isInViewport
                    })),
                    totalElements: browserState.totalElements,
                    viewport: browserState.viewportInfo,
                    pageInfo: browserState.pageInfo
                };

                result = { success: true, data: rawContext };
                break;
            }

            case "save_pdf": {
                const filename = parameters.filename || `page-${Date.now()}.pdf`;
                await pageInstance.pdf({
                    path: filename,
                    format: parameters.format || 'A4',
                    printBackground: false
                });
                result = { success: true, data: { savedAs: filename } };
                if (logged) console.log(`💾 PDF saved as ${filename}`);
                break;
            }

            // ===== FILE OPERATIONS =====
            case "upload_file": {
                const fileElements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                const fileElement = fileElements.elementMap[parameters.index];
                
                if (!fileElement || fileElement.attributes.type !== 'file') {
                    throw new Error(`Element at index ${parameters.index} is not a file input`);
                }

                const fileInput = await pageInstance.$(fileElement.xpath.replace('//*[@id="', '#').replace('"]', ''));
                if (!fileInput) {
                    throw new Error('File input element not found');
                }

                await fileInput.uploadFile(parameters.file_path);
                result = { success: true, data: { uploadedFile: parameters.file_path } };
                if (logged) console.log(`📁 Uploaded file: ${parameters.file_path}`);
                break;
            }

            // ===== RUNTIME CONTROL =====
            case "ask_user": {
                result = { 
                    success: true, 
                    data: { 
                        question: parameters.question,
                        requiresUserInput: true 
                    } 
                };
                if (logged) console.log(`❓ Asked user: ${parameters.question}`);
                break;
            }

            case "execute_javascript": {
                const jsResult = await pageInstance.evaluate(parameters.script);
                result = { success: true, data: { result: jsResult } };
                if (logged) console.log(`⚙️ Executed JavaScript`);
                break;
            }
            // ===== FALLBACK =====
            default:
                result = { success: false, error: `Unsupported action: ${action}`, data: null };
                break;
        }

    } catch (error) {
        const errorMessage = error.message || "Unknown error occurred";
        if (logged) console.log(`❌ Error executing ${action}: ${errorMessage}`);
        
        // Attempt cleanup if error occurs
        try {
            await domService.removeHighlights();
            if (logged) console.log(`🧹 Emergency cleanup completed after error`);
        } catch (cleanupError) {
            if (logged) console.log(`⚠️ Cleanup error: ${cleanupError.message}`);
        }
        
        result = { success: false, error: errorMessage, data: null };
    }

    // Prepare return data
    const currentUrl = pageInstance && !pageInstance.isClosed() ? pageInstance.url() : null;

    return {
        success: result.success,
        data: result.data,
        error: result.error,
        current_url: currentUrl,
    };
};