import React from "react";
import HeaderBar from "../layout/HeaderBar";
import PromptInput from "../ui/PromptInput";
import InfinityCanvas from "../ui/InfinityIcon";
import BrowserSelection from "../ui/BrowserSelection";
import { useAppState } from "../../hooks/useAppState";
import ProfileIcon from "../ui/ProfileIcon";
import { v4 as uuidv4 } from 'uuid';
import { useState, useRef, useEffect } from 'react';
import SettingView from "../pages/SettingView";
import PropTypes from "prop-types";

HomeView.propTypes = {
    currentBrowserPath: PropTypes.string.isRequired,
    isConnected: PropTypes.bool.isRequired,
    onLaunchAndConnect: PropTypes.func.isRequired,
}

export default function HomeView(props) {
    const { 
        openHistory, 
        addSession, 
        openSession,
        setActiveSessionId,
    } = useAppState();

    const {
        currentBrowserPath,
        isConnected,
        onLaunchAndConnect,
    } = props;
    
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const settingsMenuRef = useRef(null);
    const profileIconRef = useRef(null);

    // placeholder username
    const username = "User";

    // click outside detection
    useEffect(() => {
        function handleClickOutside(event) {
            if (!showSettingsMenu) return;
            
            if (
                settingsMenuRef.current && 
                !settingsMenuRef.current.contains(event.target) &&
                (!profileIconRef.current || !profileIconRef.current.contains(event.target))
            ) {
                setShowSettingsMenu(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showSettingsMenu]);
    
    // profile button
    const profileButton = {
        component: ProfileIcon,
        props: { 
            username,
            ref: profileIconRef 
        },
        onClick: () => setShowSettingsMenu(prev => !prev)
    };
    
    const createSession = async (text) => {
        const newSession = {
            id: uuidv4().toString(),
            title: text,
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            isActive: "true"
        }
        return newSession;
    }
    
    const handleSubmit = async (text) => {
        const newSession = await createSession(text); // fastapi /plan
        addSession(newSession);
        setActiveSessionId(newSession.id);
        openSession(newSession.id);
    }

    return (
        <div className="flex flex-col h-screen relative">
            <HeaderBar 
                title=""
                leftAction={{ icon: "history", onClick: openHistory }}
                rightAction={profileButton}
            />
            {/* browser selection here */}
            <div className="absolute top-12 left-0 right-0 flex flex-col w-full items-center justify-center">
                <div className="flex items-center pl-3.5 w-full h-12">
                    <BrowserSelection 
                        currentBrowserPath={currentBrowserPath}
                        isConnected={isConnected} 
                        onLaunchAndConnect={onLaunchAndConnect}
                    />
                </div>
            </div>
            
            {showSettingsMenu && (
                <div className="absolute top-10 right-4 z-10" ref={settingsMenuRef}>
                    <SettingView onClose={() => setShowSettingsMenu(false)} />
                </div>
            )}

            <div className="flex-grow flex justify-center pt-[40%]">
                <div className="w-[200px] h-[200px] rounded-full">
                    <InfinityCanvas />
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0">
                <PromptInput 
                    placeholder="What would you like the browser to do?"
                    onSubmit={handleSubmit} 
                />
            </div>
        </div>
    );
}
