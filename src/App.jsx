import React, { useEffect, useCallback, useRef } from "react";
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
    getWsFor,
  } = useAppState();


  /*
  ** use ref to prevent multiple connection attempts
  */
  const connectionInProgress = useRef(false);
  const reconnectTimeoutRef = useRef(null);

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

  /*
  ** validate websocket endpoint with backend
  */
  const validateWebSocket = useCallback(async (ws, browserPath) => {
    try {
      await invoke("validate_ws_endpoint", {
        wsEndpoint: ws,
        selectedBrowserPath: browserPath
      });
      return true;
    } catch (error) {
      console.log("WebSocket validation failed:", error);
      return false;
    }
  }, []);

  /*
  ** auto-reconnect if we have a stored WS but no browser instance
  */
  const checkAndReconnect = useCallback(async () => {
    // Don't reconnect if already in progress or if browser exists
    if (browserInstance || connectionInProgress.current) return;
    
    const ws = getWsFor(currentBrowserPath);
    if (!ws || !currentBrowserPath) return;

    connectionInProgress.current = true;

    try {
      // first validate the WS endpoint with the backend
      const isValid = await validateWebSocket(ws, currentBrowserPath);
      
      if (!isValid) {
        console.log("Stored WebSocket is invalid, clearing it");
        forgetBrowser(currentBrowserPath);
        setIsConnected(false);
        return;
      }

      // if valid, try to connect
      const browser = await connectPuppeteer(ws);
      
      if (browser) {
        console.log("Successfully reconnected to browser");
        setBrowserInstance(browser);
        setIsConnected(true);

        // set up disconnect handler
        browser.on("disconnected", () => {
          console.log("Browser disconnected");
          handleBrowserDisconnect();
        });
      }
    } catch (error) {
      console.log("Reconnect failed:", error);
      forgetBrowser(currentBrowserPath);
      setIsConnected(false);
    } finally {
      connectionInProgress.current = false;
    }
  }, [browserInstance, currentBrowserPath, getWsFor, connectPuppeteer, setBrowserInstance, setIsConnected, forgetBrowser, validateWebSocket]);

  const connectBrowser = useCallback(async (browserPath) => {
    const path = browserPath || currentBrowserPath;
    if (!path) { console.log("no browser selected"); return; }
    
    // prevent multiple simultaneous connections
    if (connectionInProgress.current) {
      console.log("Connection already in progress");
      return;
    }

    connectionInProgress.current = true;

    try {
      // check if we have a stored WS endpoint first
      const storedWs = getWsFor(path);
      let ws = storedWs;
      
      if (storedWs) {
        // validate the stored endpoint
        const isValid = await validateWebSocket(storedWs, path);
        if (!isValid) {
          console.log("Stored WS is invalid, launching new browser");
          forgetBrowser(path);
          ws = null;
        }
      }
      
      // if no valid WS, launch new browser
      if (!ws) {
        setIsConnected(false);
        ws = await invoke("launch_browser", { browserPath: path });
        console.log("New browser launched with WS:", ws);
      }

      /*
      ** assert the connection
      */
      await invoke("validate_connection", {
        wsEndpoint: ws,
        selectedBrowserPath: path
      });

      /*
      ** memorise endpoint so we can reconnect next time
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
      const pages = await browser.pages();
      if (pages.length === 0) {
        const page = await browser.newPage();
        setPageInstance(page);
      } else {
        setPageInstance(pages[0]);
      }

      setIsConnected(true);
      console.log("♾️");

      /*
      ** housekeeping
      */
      browser.on("disconnected", () => {
        console.log("Puppeteer disconnected");
        handleBrowserDisconnect();
      })

    } catch (error) {
      console.log("failed to connect to browser", error);
      setIsConnected(false);
      setBrowserInstance(null);
      setPageInstance(null);
      forgetBrowser(path);
    } finally {
      connectionInProgress.current = false;
    }
  }, [
    currentBrowserPath,
    getWsFor,
    rememberBrowser,
    forgetBrowser,
    setBrowserInstance,
    setPageInstance,
    setIsConnected,
    connectPuppeteer,
    validateWebSocket
  ])

  /*
  ** handle browser disconnect
  */
  const handleBrowserDisconnect = useCallback(() => {
    setBrowserInstance(null);
    setPageInstance(null);
    setIsConnected(false);
    
    // try to reconnect after a delay
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log("Attempting to reconnect after disconnect...");
      checkAndReconnect();
    }, 2000);
  }, [setBrowserInstance, setPageInstance, setIsConnected, checkAndReconnect]);

  /*
  ** check for lost connection on mount and periodically
  */
  useEffect(() => {
    // initial check
    checkAndReconnect();

    // set up periodic check
    const interval = setInterval(() => {
      if (!browserInstance && currentBrowserPath) {
        console.log("Browser instance lost, attempting reconnect...");
        checkAndReconnect();
      }
    }, 5000); // check every 5 seconds

    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [browserInstance, currentBrowserPath, checkAndReconnect]);

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
