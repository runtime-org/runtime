

export const createPagePool = ({ browser, maxTabs = 10}) => {
  let active = 0;
  const waiters = [];

  /*
  * acquire a page from the pool
  */
  async function acquire() {
    const existingPages = await browser.pages();
    console.log("existingPages", existingPages);

    if (existingPages.length > 0) {
      return existingPages[0];
    }
    if (active >= maxTabs) {
      await new Promise(function(res) { waiters.push(res); });
    }
    active += 1;
    return browser.newPage();
  }

  /*
  * release a page back to the pool
  */
  async function release(page) {
    try { await page.close(); } catch { /* ignore */ }
    active -= 1;
    const next = waiters.shift();
    if (next) next();          // wake one waiter
  }

  /*
  * return a page from the pool
  */
   return async function pageManager() {
    const existingPages = await browser.pages();
    const isReusedPage = existingPages.length > 0;
    
    const page = await acquire();
    
    /*
    * auto release when the caller is finished
    */
    if (!isReusedPage) {
      page.once('close', () => release(page));
    }
    return page;
   }
};