import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import posthog from '../lib/posthogSetup';

const version = "0.1.0";

export const useAppState = create(
    persist(
        (set, get) => ({
            // states
            view: "home",      // home | history | session | profile
            sessions: [],      // [{id, title, lastUpdated, createdAt, isActive, ...}]
            sessionMessages: {}, // {sessionId: [messages]}
            activeSessionId: null, // UUID or null
            currentQuery: "",
            availableBrowsers: [], // [{id, name, path}]
            runtimeMode: "research", // "research" | "action"
            synthesisInProgress: {},

            selectedModel: "gemini", // "gemini"
            availableModels: [
                { id: "gemini", name: "Gemini", description: "Great for reasoning" }
            ],

            currentBrowserPath: null,
            browserPool: {}, // {[path]: wsEndpoint}

            browserInstance: null,
            pageInstance: null,
            isConnected: false,

            selectedTabs: [], // [{title, url, page}]
            pendingPages: [],


            // actions
            setActiveSessionId: (id) => set({activeSessionId: id}),
            
            /*
            ** model handling
            */
            setSelectedModel: (modelId) => set({selectedModel: modelId}),
            getSelectedModel: () => get().selectedModel,
            getAvailableModels: () => get().availableModels,
            
            /*
            ** query handling
            */
            setCurrentQuery: (query) => set({currentQuery: query}),
            setRuntimeMode: (mode) => set({runtimeMode: mode}),
            setSynthesisInProgress: (taskId, inProgress) => set(state => ({
                synthesisInProgress: {
                    ...state.synthesisInProgress,
                    [taskId]: inProgress
                }
            })),
            getSynthesisInProgress: (taskId) => get().synthesisInProgress[taskId] || false,
            /*
            ** view handling
            */
            openHome: () => {
                // posthog.capture('navigation_to_home', { version });
                set({view: "home", activeSessionId: null});
            },
            openHistory: () => {
                posthog.capture('navigation_to_history', { version });
                set({view: "history"});
            },
            openSession: (id) => set({view: "session", activeSessionId: id}),
            openProfile: () => set({view: "profile"}),
            /*
            ** session handling
            */
            addSession: session =>  set(state => ({sessions: [session, ...state.sessions]})),
            clearSessions: () => set({ sessions: [], sessionMessages: {} }),
            getSessionMessages: (sessionId) => get().sessionMessages[sessionId] || [],
            addMessageToSession: (sessionId, message, update = false) =>
                set(state => {
                    const currentMessages = state.sessionMessages[sessionId] || [];
                    
                    if (update) {
                        /*
                        ** replace existing message with same id
                        */
                        const updatedMessages = currentMessages.map(m => 
                            m.id === message.id ? message : m
                        );
                        return {
                            sessionMessages: {
                                ...state.sessionMessages,
                                [sessionId]: updatedMessages
                            }
                        };
                    } else {
                        /*
                        ** add new message (prepend)
                        */
                        return {
                            sessionMessages: {
                                ...state.sessionMessages,
                                [sessionId]: [...currentMessages, message]
                            }
                        };
                    }
            }),
            setCurrentBrowserPath: (path) => set({currentBrowserPath: path}),
            /*
            ** add/update one entry
            */
            rememberBrowser: (path, ws) => {
                set(s => ({ browserPool: {...s.browserPool, [path]: ws}}))
            },
            /*
            ** drop one entry (only when it is actively closed)
            */
            forgetBrowser: (path) => {
                set(s => { 
                    const pool = {...s.browserPool};
                    delete pool[path];
                    return { browserPool: pool }
                })
            },
            getWsFor: path => get().browserPool[path] || null,
            
            /*
            ** browser-related actions
            */
            getSelectedTabs: () => get().selectedTabs,
            addSelectedTab: (tab) => set(state => {
                const exists = state.selectedTabs.some(t => t.title === tab.title && t.url === tab.url);
                return exists ? state : { selectedTabs: [...state.selectedTabs, tab] };
            }),
            removeSelectedTab: (title, url) => set(state => ({
                selectedTabs: state.selectedTabs.filter(t => !(t.title === title && t.url === url))
            })),
            clearSelectedTabs: () => set({ selectedTabs: [] }),
            setBrowserInstance: (instance) => set({browserInstance: instance}),
            setPageInstance: (instance) => set({pageInstance: instance}),
            setIsConnected: (connected) => set({isConnected: connected}),
            loadAvailableBrowsers: async () => {
                try {
                    const browsers = await invoke("fetch_available_browsers");
                    set({availableBrowsers: browsers});
                } catch (error) {
                    console.error("Failed to load available browsers:", error);
                    set({availableBrowsers: []});
                }
            },
            
            /*
            ** pages handling for navigation
            */
            setPendingPages: (pages) => set({ pendingPages: pages }),
            getPendingPages: () => get().pendingPages,
            clearPendingPages: () => set({ pendingPages: [] }),
        }),
        {
            name: "app-sessions",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ 
                sessions: state.sessions,
                currentBrowserPath: state.currentBrowserPath,
                sessionMessages: state.sessionMessages,
                browserPool: state.browserPool,
                isConnected: state.isConnected,
                runtimeMode: state.runtimeMode,
                synthesisInProgress: state.synthesisInProgress,
                selectedModel: state.selectedModel,
            }),
        }
    )
)