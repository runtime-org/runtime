import React, { useEffect } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { useAppState } from "../../hooks/useAppState";
import { browserIcons } from "../../lib/utils";

BrowserSelection.propTypes = {
  onLaunchAndConnect: PropTypes.func.isRequired,
  onCloseBrowser: PropTypes.func.isRequired,
  isConnected: PropTypes.bool.isRequired,
};

export default function BrowserSelection({
  isConnected,
  onLaunchAndConnect,
  onCloseBrowser,
}) {
  /*
  ** global state
  */
  const {
    availableBrowsers,
    selectedBrowserPath,
    setSelectedBrowserPath,
  } = useAppState();

  /*
  ** keep selection valid when list refreshes
  */
  useEffect(() => {
    if (
      availableBrowsers.length &&
      !availableBrowsers.some(
        (b) => b.path === selectedBrowserPath)
    ) {
      setSelectedBrowserPath(availableBrowsers[0].path);
    }
  }, [availableBrowsers, selectedBrowserPath, setSelectedBrowserPath]);

  /*
  ** click handler
  */
  const pickBrowser = async (browser) => {
    if (browser.path === selectedBrowserPath && isConnected) return;

    if (isConnected) {
      await onCloseBrowser(true);
    }

    setSelectedBrowserPath(browser.path);

    await onLaunchAndConnect(browser.path);
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
        const isSel = b.path === selectedBrowserPath;
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
              className="w-6 h-6"
            />
            {isSel && (
              <span
                className={clsx(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full",
                  isConnected ? "bg-green-500" : "bg-gray-500"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}