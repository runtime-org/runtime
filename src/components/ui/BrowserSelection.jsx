import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { useAppState } from "../../hooks/useAppState";
import { browserIcons } from "../../lib/utils";
import posthog from '../../lib/posthogSetup'

BrowserSelection.propTypes = {
  onLaunchAndConnect: PropTypes.func.isRequired,
  isConnected: PropTypes.bool.isRequired,
};

const version = "0.1.0";

export default function BrowserSelection({
  isConnected,
  onLaunchAndConnect,
}) {
  /*
  ** global state
  */
  const [isBrowserLaunching, setIsBrowserLaunching] = useState(false);
  const {
    availableBrowsers,
    currentBrowserPath,
    setCurrentBrowserPath,
    loadAvailableBrowsers,
  } = useAppState();

  /*
  ** fetch once on mount
  */
  useEffect(() => {
    if (availableBrowsers.length === 0) {
      loadAvailableBrowsers();
    }
  }, [availableBrowsers.length, loadAvailableBrowsers]);

  /*
  ** keep selection valid
  */
  useEffect(() => {
    if (
      availableBrowsers.length &&
      !availableBrowsers.some(
        (b) => b.path === currentBrowserPath)
    ) {
      setCurrentBrowserPath(availableBrowsers[0].path);
    }
  }, [availableBrowsers, currentBrowserPath]);

  /*
  ** watch whenever the browser is connected, then 
  */
  useEffect(() => {
    if (isConnected) {
      setIsBrowserLaunching(false);
    }
  }, [isConnected]);

  /*
  ** click handler
  */
  const pickBrowser = async (browser) => {
    setCurrentBrowserPath(browser.path);
    setIsBrowserLaunching(true);
    await onLaunchAndConnect(browser.path);
    
    // map browser names to clean event names
    const browserMap = {
      'Google Chrome': 'chrome',
      'Mozilla Firefox': 'firefox',
      'Safari': 'safari',
      'Microsoft Edge': 'edge',
      'Opera': 'opera'
    };
    
    const eventName = browserMap[browser.name] || browser.name.toLowerCase().replace(/\s+/g, '');
    posthog.capture(`${eventName}_active`, { version } );
  };

  /*
  ** empty state
  */
  if (!availableBrowsers.length) {
    return (
      <div className="px-3 py-1.5 rounded-md bg-[#3a3a3a] text-sm text-gray-400">
        No browsers detected
      </div>
    );
  }

  /*
  ** UI
  */
  return (
    <div className="flex gap-2 px-2 py-2 bg-[#303030] rounded-md border border-[#494949]/60 select-none mt-2">
      {availableBrowsers.map((b) => {
        const isSel = b.path === currentBrowserPath;
        const showDot = isSel;
        const isUp = isSel && isConnected;
        return (
          <button
            key={b.path}
            title={b.name}
            onClick={() => pickBrowser(b)}
            className={clsx(
              "relative p-1 rounded-md hover:bg-[#3a3a3a] transition-colors",
              isSel && "ring-2 ring-blue-500"
            )}
          >
            <img
              src={browserIcons[b.id] || browserIcons.default}
              alt={b.name}
              className={clsx(
                "w-6 h-6",
                isBrowserLaunching && isSel && "animate-spin"
              )}
            />
            {showDot && (
              <span
                className={clsx(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full",
                  isUp ? "bg-green-500" : "bg-gray-500"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}