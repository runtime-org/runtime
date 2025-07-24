import React, { useEffect, useCallback } from "react";

import "./App.css";
import Frame from "./components/layout/Frame";
import HomeView from "./components/pages/HomeView";
import HistoryView from "./components/pages/HistoryView";
import SessionView from "./components/pages/SessionView";
import { useAppState } from "./hooks/useAppState";
import puppeteer from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';
import { invoke } from "@tauri-apps/api/core";

function App() {
  const { 
    view,
    selectedBrowserPath,
    savedWsEndpoint,
    setSavedWsEndpoint,
    clearSavedWsEndpoint,
    fetchBrowsers,
    browserInstance,
    logs,
    isConnected,
    setBrowserInstance,
    setPageInstance,
    setIsConnected,
    addLog,
    // eslint-disable-next-line no-unused-vars
    clearLogs
  } = useAppState();

  const attemptReconnectionWithSavedEndpoint = async () => {
    if (!savedWsEndpoint || !selectedBrowserPath) {
      return;
    }

    try {
      addLog(`attempting to reconnect to saved endpoint: ${savedWsEndpoint}`, "info");
      
      const validationResult = await invoke("validate_ws_endpoint", { 
        wsEndpoint: savedWsEndpoint, 
        selectedBrowserPath 
      });
      
      addLog(`rust: ${validationResult}`, "success");
      setIsConnected(true);
      
      try {
        addLog("connecting puppeteer to saved endpoint...", "info");
        const browser = await puppeteer.connect({ 
          browserWSEndpoint: savedWsEndpoint, 
          defaultViewport: null 
        });
        
        setBrowserInstance(browser);
        
        const pages = await browser.pages();
        const currentPage = pages.length > 0 ? pages[0] : await browser.newPage();
        setPageInstance(currentPage);
        
        addLog("successfully reconnected to existing browser instance ♾️", "success");
        
        browser.on("disconnected", () => {
          addLog("puppeteer disconnected", "warn");
          setBrowserInstance(null);
          setPageInstance(null);
          setIsConnected(false);
          clearSavedWsEndpoint();
        });
        
      } catch (puppeteerError) {
        addLog(`could not connect puppeteer: ${puppeteerError.message}`, "warn");
        setIsConnected(false);
        clearSavedWsEndpoint();
      }
      
    } catch (error) {
      addLog(`saved endpoint is no longer valid: ${error.message}`, "warn");
      setIsConnected(false);
      clearSavedWsEndpoint();
    }
  };

  useEffect(() => {
    fetchBrowsers(false);
    console.log("isConnected", isConnected);
    
    // crystal clear
    return () => {
      if (isConnected) {
        console.log("Disconnecting from browser...");
        handleCloseBrowser(false);
      }
    };
  }, [fetchBrowsers]);

  useEffect(() => {
    if (selectedBrowserPath && savedWsEndpoint && !isConnected) {
      attemptReconnectionWithSavedEndpoint();
    }
  }, [selectedBrowserPath, savedWsEndpoint]);

  const handleLaunchAndConnect = async (browserPathParam) => {
    const browserPath = browserPathParam || selectedBrowserPath;
    if (!browserPath) {
      console.log("no browser selected");
      return;
    }

    // first forward
    try {
      console.log("launching browser...");
      const wsEndpoint = await invoke("launch_browser", { browserPath });
      console.log("connecting to", wsEndpoint);
      
      setSavedWsEndpoint(wsEndpoint);
      
      try {
        const validationResult = await invoke("validate_connection", { 
          wsEndpoint, 
          selectedBrowserPath: browserPath
        });
        addLog("Rust: " + validationResult, "success");
        setIsConnected(true);
      } catch (validationError) {
        addLog(`Browser validation failed: ${validationError}`, "error");
        setIsConnected(false);
        clearSavedWsEndpoint();
        return;
      }
      
      let browser;
      let retries = 2;
      
      addLog("Establishing puppeteer connection...", "info");
      // second forward (pptr)
      while (retries > 0) {
        try {
          addLog("-> Connecting puppeteer...", "info");
          browser = await puppeteer.connect({ 
            browserWSEndpoint: wsEndpoint, 
            defaultViewport: null 
          });
          addLog("♾️ Puppeteer connected", "success");
          break; 
        } catch (connectError) {
          console.log("connectError", connectError);
          retries--;
          if (retries === 0) {
            addLog("Puppeteer connection failed, but browser is running", "warn");
            addLog("This might be a temporary issue, try again", "info");
            return;
          }
          addLog(`Puppeteer retry ${2-retries}/2...`, "info");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setBrowserInstance(browser);
      
      const currentPage = await browser.newPage();

      try {
        await currentPage.goto("https://www.youtube.com", {
          waitUntil: "domcontentloaded",
          timeout: 10000
        });
      } catch (error) {
        console.error("error", error) 
      }
      setPageInstance(currentPage);
      
      addLog("Full connection established ♾️", "success");

      browser.on("disconnected", () => {
        addLog("Puppeteer disconnected", "warn");
        setBrowserInstance(null);
        setPageInstance(null);
        setIsConnected(false);
        clearSavedWsEndpoint();
      });

    } catch (error) {
      const errorMessage = error.message || (typeof error === "string" ? error: JSON.stringify(error));
      addLog(`Failed to connect: ${errorMessage}`, "error");
      setIsConnected(false);
      setBrowserInstance(null);
      setPageInstance(null);
      clearSavedWsEndpoint();
    }
  }

  const handleCloseBrowser = useCallback(async (shouldDisconnectPuppeteer = false) => {
    addLog("attempting to close browser...", "info");
    if (shouldDisconnectPuppeteer && browserInstance && browserInstance.isConnected()) {
      try {
        await browserInstance.disconnect();
        addLog("pptr instance disconnected.", 'info');
      } catch (error) {
        addLog(`Error disconnecting puppeteer: ${error.message}`, 'warn');
      }
    }

    try {
      await invoke('disconnect_from_browser');
      addLog("Backend command to close browser completed.", 'success');
    } catch (error) {
      addLog(`Error disconnecting from backend: ${error.message}`, 'warn');
    }

    setBrowserInstance(null);
    setPageInstance(null);
    setIsConnected(false);
    clearSavedWsEndpoint();
  }, [browserInstance, addLog, clearSavedWsEndpoint]);


  const homeViewProps = {
    selectedBrowserPath,
    logs,
    isConnected,

    onLaunchAndConnect: handleLaunchAndConnect,
    onCloseBrowser: handleCloseBrowser,
  }

  const sessionViewProps = {
    browserInstance,
    isConnected
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
