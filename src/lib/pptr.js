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
                // const clickableElements = await domService.getClickableElementsWithIndices({ highlightElements: false });
                // const clickResult = await domService.clickElementByIndex(parameters.index, clickableElements.elementMap);
                const elements = await domService.collectIntertiveElements();
                const clickResult = await domService.clickElement({ targetIndex: parameters.index, elements });
                
                if (clickResult.isFileInput) {
                    result = { success: false, error: clickResult.message, data: null };
                } else {
                    result = { success: true, data: clickResult };
                    if (logged) console.log(`🖱️ ${clickResult.message}`);
                }
                break;
            } 
            case "input_text": {
                try {
                    const elements = await domService.collectIntertiveElements();
                    const inputResult = await domService.typeTextByIndex(parameters.index, elements, parameters.text);

                    result = { success: true, data: inputResult };
                    if (logged) console.log(`⌨️ Input text into element ${parameters.index}`);
                } catch (error) {
                    result = { success: false, error: error.message, data: null };
                    if (logged) console.log(`❌ Error inputting text: ${error.message}`);
                }
                break;
            }
            case "send_keys": {
                try {
                    const elements = await domService.collectIntertiveElements();
                    const inputResult = await domService.typeTextByIndex(parameters.index, elements, parameters.keys);
                    result = { success: true, data: inputResult };
                    if (logged) console.log(`⌨️ Sent keys: ${parameters.keys}`);
                } catch (error) {
                    result = { success: false, error: error.message, data: null };
                    if (logged) console.log(`❌ Error sending keys: ${error.message}`);
                }                
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

            case "get_visible_text": {
                const visibleText = await domService.getVisibleText();
                result = { success: true, data: { visibleText } };
                if (logged) console.log(`🔍 Retrieved visible text`);
                break;
            }

            // ===== PAGE STATE =====
            case "get_simplified_page_context": {

                const elements = await domService.getInteractiveElements();
                console.log("elements", elements);

                const rawContext = {
                    interactiveElements: elements.map(e => ({
                        index : e.index,
                        tag : e.tag,
                        accessibleName : e.accessibleName,
                        href : e.href
                    })),
                    totalElements : elements.length,
                };

                result = { success: true, data: rawContext };
                break;
            }

            case "get_simplified_page_context_legacy": {
                let browserState;

                try {
                    // apply highlights
                    browserState = await domService.getClickableElementsWithIndices({
                        highlightElements: false,
                        maxElements: parameters.max_elements || 100,
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
                }

                // if browserState was not populated due to an error before its assignment
                if (!browserState) {
                    // fallback: get elements without highlighting if the primary path failed
                    browserState = await domService.getClickableElementsWithIndices({
                        highlightElements: false,
                        maxElements: parameters.max_elements || 100
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