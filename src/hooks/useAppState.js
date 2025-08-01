import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

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

            currentBrowserPath: null,
            browserPool: {}, // {[path]: wsEndpoint}

            browserInstance: null,
            pageInstance: null,
            isConnected: false,

            // actions
            setActiveSessionId: (id) => set({activeSessionId: id}),
            /*
            ** query handling
            */
            setCurrentQuery: (query) => set({currentQuery: query}),
            setRuntimeMode: (mode) => set({runtimeMode: mode}),
            /*
            ** view handling
            */
            openHome: () => set({view: "home", activeSessionId: null}),
            openHistory: () => set({view: "history"}),
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
            }
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
            }),
        }
    )
)