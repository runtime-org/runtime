import React, { useEffect, useCallback } from "react";
import puppeteer from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import Frame from "./components/layout/Frame";
import HomeView from "./components/pages/HomeView";
import HistoryView from "./components/pages/HistoryView";
import SessionView from "./components/pages/SessionView";
import { useAppState } from "./hooks/useAppState";

function App() {
  const { 
    view,
    isConnected,
    currentBrowserPath,
    browserInstance,
    rememberBrowser,
    forgetBrowser,
    setBrowserInstance,
    setPageInstance,
    setIsConnected,
  } = useAppState();

  /*
  ** connect pptr
  */
  const connectPuppeteer = useCallback(async (ws, retries = 2) => {
    while (retries--) {
      try {
        return await puppeteer.connect({
          browserWSEndpoint: ws,
          defaultViewport: null
        })
      } catch (error) {
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, [])

  const connectBrowser = useCallback(async (browserPath) => {
    const path = browserPath || currentBrowserPath;
    if (!path) { console.log("no browser selected"); return; }

    try {
      /*
      ** launch or reuse a browser
      */
      setIsConnected(false);
      const ws = await invoke("launch_browser", { browserPath: path });
      console.log("connecting...");

      /*
      ** asserte the connection
      */
      await invoke("validate_connection", {
        wsEndpoint: ws,
        selectedBrowserPath: path
      });

      /*
      ** memorise endpoint so we can reconect next time
      */
      rememberBrowser(path, ws);

      /*
      ** attach pptr
      */
      const browser = await connectPuppeteer(ws);
      console.log("browser connected", browser);
      setBrowserInstance(browser);

      /*
      ** open starter tab (will replace with our own static page)
      */

      const page = await browser.newPage();
      
      setPageInstance(page);

      // await page.goto("https://www.youtube.com", {
      //   waitUntil: "domcontentloaded",
      //   timeout: 10000
      // });

      setIsConnected(true);
      console.log("♾️");

      /*
      ** housekeeping
      */
      browser.on("disconnected", () => {
        console.log("Puppeteer disconnected");
        setBrowserInstance(null);
        setPageInstance(null);
        setIsConnected(false);
        forgetBrowser(path);
      })

    } catch (error) {
      console.log("failed to connect to browser", error);
      setIsConnected(false);
      setBrowserInstance(null);
      setPageInstance(null);
      forgetBrowser(path);
    }
  }, [
    currentBrowserPath,
    rememberBrowser,
    forgetBrowser,
    setBrowserInstance,
    setPageInstance,
    setIsConnected
  ])

  /*
  ** home view props
  */
  const homeViewProps = {
    currentBrowserPath,
    isConnected,
    onLaunchAndConnect: connectBrowser
  }

  /*
  ** session view props
  */
  const sessionViewProps = {
    browserInstance,
    isConnected,
    connectBrowser
  };

  return (
    <Frame>
      { view === "home" && <HomeView {...homeViewProps} />}
      { view === "history" && <HistoryView />}
      { view === "session" && <SessionView {...sessionViewProps} />}
    </Frame>
  )
}

export default App;
