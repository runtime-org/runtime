import React, { useState, useRef, useEffect } from 'react';
import { HiChevronRight } from 'react-icons/hi';
import { useAppState } from '../../hooks/useAppState';
import { browserIcons } from '../../lib/utils';
import PropTypes from 'prop-types';

BrowserSelection.propTypes = {
    isConnected: PropTypes.bool.isRequired,
    onLaunchAndConnect: PropTypes.func.isRequired,
    onCloseBrowser: PropTypes.func.isRequired,
}

export default function BrowserSelection(props) {
    const { 
        availableBrowsers, 
        selectedBrowserPath, 
        setSelectedBrowserPath 
    } = useAppState();
    const [isOpen, setIsOpen] = useState(false);
    const modalRef = useRef(null);
    const browserButtonRef = useRef(null);

    const { isConnected, onLaunchAndConnect, onCloseBrowser } = props;
    
    const selectedBrowser = availableBrowsers.find(browser => 
        browser.path === selectedBrowserPath
    ) || { id: 'default', name: 'Browser' };
    
    useEffect(() => {
        function handleClickOutside(event) {
            if (!isOpen) return;
            
            if ( modalRef.current && 
                !modalRef.current.contains(event.target) &&
                (!browserButtonRef.current || !browserButtonRef.current.contains(event.target))
            ) {
                setIsOpen(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);
  
    const toggleModal = () => {
        setIsOpen(prev => !prev);
    };
  
    const selectBrowser = (browserPath) => {
        setSelectedBrowserPath(browserPath);
        setIsOpen(false);
        
        if (!isConnected) {
            setTimeout(() => {
                onLaunchAndConnect();
            }, 100);
        }
    };
  
    const browserIcon = browserIcons[selectedBrowser.id] || browserIcons.default;

    const handleConnectDisconnect = () => {
        if (isConnected) {
            onCloseBrowser(true);
        } else {
            onLaunchAndConnect();
        }
    };
  
    return (
        <div className="relative flex items-center w-full">
            <div 
                ref={browserButtonRef}
                className="flex items-center cursor-pointer gap-2"
                onClick={toggleModal}
            >
                <div className="w-6 h-6 flex items-center justify-center">
                    <img src={browserIcon} alt={selectedBrowser.name} className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    <span className="text-white text-sm ml-1">{isConnected ? 'Connected' : 'Disconnected'}</span>
                    <HiChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                </div>
            </div>
        
        {isOpen && (
            <div ref={modalRef}
                className="absolute top-full left-0 right-0 mt-1 bg-[#242424] border border-[#484848]/70 rounded-md shadow-lg z-10"
                >
                <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                        <span className="text-white text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    
                    <button onClick={handleConnectDisconnect}
                        className={`w-full py-1 px-4 rounded-md text-white font-medium ${
                            isConnected ? 'bg-[#323232] hover:bg-[#484848]' : 'bg-blue-600 hover:bg-blue-700'
                        } transition-colors`}
                        >
                        {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                </div>
            
                <div className="h-px bg-[#484848]/70 mx-2"></div>
            
                <div className="py-2">
                    <div className="px-4 mb-1 text-xs text-gray-400 uppercase">Available Browsers</div>
                    { availableBrowsers.length > 0 ? (
                        <div>
                            {availableBrowsers.map(browser => (
                            <div 
                                key={browser.path}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-[#323232] cursor-pointer"
                                onClick={() => selectBrowser(browser.path)}
                            >
                                {browser.path === selectedBrowserPath && ( <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> )}
                                {browser.path !== selectedBrowserPath && ( <div className="w-1.5 h-1.5"></div> )}
                                <div className="w-5 h-5 flex items-center justify-center">
                                <img 
                                    src={browserIcons[browser.id] || browserIcons.default} 
                                    alt={browser.name} 
                                    className="w-4 h-4" 
                                />
                                </div>
                                <span className="text-white text-sm">{browser.name}</span>
                            </div>
                            ))}
                        </div>
                        ) : (
                        <div className="px-4 py-2 text-gray-400 text-sm">
                            No browsers available
                        </div>
                    )}
                </div>
            </div>
        )}
        </div>
    );
}