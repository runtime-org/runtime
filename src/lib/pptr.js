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
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(parameters.query)}`;
                await pageInstance.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                result = { success: true, data: { searchQuery: parameters.query, navigatedTo: searchUrl } };
                if (logged) console.log(`🔍 Searched for "${parameters.query}" in Google`);
                break;
            }

            case "go_to_url": {
                await pageInstance.goto(parameters.url, { waitUntil: 'networkidle2', timeout: 50000 });
                result = { success: true, data: { navigatedTo: parameters.url } };
                if (logged) console.log(`🔗 Navigated to ${parameters.url}`);
                break;
            }

            case "go_back": {
                await pageInstance.goBack({ waitUntil: 'networkidle2' });
                result = { success: true, data: { action: 'navigated back' } };
                if (logged) console.log("🔙 Navigated back");
                break;
            }

            case "go_forward": {
                await pageInstance.goForward({ waitUntil: 'networkidle2' });
                result = { success: true, data: { action: 'navigated forward' } };
                if (logged) console.log("⏭️ Navigated forward");
                break;
            }
            case "refresh_page": {
                await pageInstance.reload({ waitUntil: 'networkidle2' });
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
                        highlightElements: false,
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

            // ===== OVERLAY =====
            case 'show_mesh_overlay': {
                await domService.showMeshOverlay(pageInstance);
                result = { success:true, data:null };
                break;
            }
            case 'hide_mesh_overlay': {
                await domService.hideMeshOverlay(pageInstance);
                result = { success:true, data:null };
                break;
            }
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