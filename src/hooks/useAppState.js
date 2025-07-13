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
            currrentQuery: "",
            availableBrowsers: [], // [{id, name, path}]
            selectedBrowserPath: null,
            savedWsEndpoint: null, // currentws endpoint
            isLoadingBrowsers: false,
            errorLoadingBrowsers: null,
            lastBackgroundUpdateAttempt: 0,
            browserInstance: null,
            pageInstance: null,
            logs: [],
            isConnected: false,

            // actions
            setActiveSessionId: (id) => set({activeSessionId: id}),
            setCurrentQuery: (query) => set({currrentQuery: query}),
            openHome: () => set({view: "home", activeSessionId: null}),
            openHistory: () => set({view: "history"}),
            openSession: (id) => set({view: "session", activeSessionId: id}),
            openProfile: () => set({view: "profile"}),
            totalSessions: () => get().sessions.length,
            addSession: session => 
                set(state => ({sessions: [session, ...state.sessions]})),
            removeSession: (id) =>
                set(state => ({
                    sessions: state.sessions.filter(session => session?.id !== id),
                    sessionMessages: {...state.sessionMessages, [id]: undefined}
                })),
            clearSessions: () => set({ sessions: [], sessionMessages: {} }),
            getSessionMessages: (sessionId) => get().sessionMessages[sessionId] || [],
            saveSessionMessages: (sessionId, messages) => 
                set(state => ({
                    sessionMessages: {
                        ...state.sessionMessages,
                        [sessionId]: messages
                    }
                })),
            addMessageToSession: (sessionId, message, update = false) =>
                set(state => {
                    const currentMessages = state.sessionMessages[sessionId] || [];
                    
                    if (update) {
                        // Replace existing message with same id
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
                        // Add new message (prepend)
                        return {
                            sessionMessages: {
                                ...state.sessionMessages,
                                [sessionId]: [...currentMessages, message]
                            }
                        };
                    }
                }),
            fetchBrowsers: async (isBackgroundUpdate = false) => {
                const now = Date.now();
                if (isBackgroundUpdate && (now - get().lastBackgroundUpdateAttempt) < 10000) { return; }

                if (!isBackgroundUpdate) {
                    set({isLoadingBrowsers: true, errorLoadingBrowsers: null});
                } else {
                    set({lastBackgroundUpdateAttempt: now});
                }

                try {
                    const browsers = await invoke("fetch_available_browsers");
                    set({
                        availableBrowsers: browsers,
                        isLoadingBrowsers: false,
                        errorLoadingBrowsers: null
                    });

                    const currentSelectedPath = get().selectedBrowserPath;
                    const selectedStillExists = browsers.some(b => b.path === currentSelectedPath)

                    if (browsers.length > 0 && (!currentSelectedPath || !selectedStillExists)) {
                        set({ selectedBrowserPath: browsers[0].path });
                    } else if (browsers.length === 0) {
                        set({ selectedBrowserPath: null}); // no browser found
                    }
                } catch (error) {
                    const errorMessage = error.message || (typeof error === 'string' ? error : "Failed to fetch browsers")
                    console.error("Failed to fetch browsers:", errorMessage);
                    if (!isBackgroundUpdate) {
                        set({errorLoadingBrowsers: errorMessage, isLoadingBrowsers: false});
                    } else {
                        console.warn("Background browser fetch failed:", errorMessage);
                    }
                }
            },

            setSelectedBrowserPath: (path) => set({selectedBrowserPath: path}),
            setSavedWsEndpoint: (endpoint) => set({savedWsEndpoint: endpoint}),
            clearSavedWsEndpoint: () => set({savedWsEndpoint: null}),
            
            // Add these browser-related actions
            setBrowserInstance: (instance) => set({browserInstance: instance}),
            setPageInstance: (instance) => set({pageInstance: instance}),
            setIsConnected: (connected) => set({isConnected: connected}),
            addLog: (message, type = "info") => 
                set(state => ({
                    logs: [`[${new Date().toLocaleTimeString()}] [${type.toUpperCase()}] ${message}`, ...state.logs.slice(0, 29)]
                })),
            clearLogs: () => set({logs: []}),
        }),
        {
            name: "app-sessions",
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ 
                sessions: state.sessions,
                selectedBrowserPath: state.selectedBrowserPath,
                sessionMessages: state.sessionMessages,
                savedWsEndpoint: state.savedWsEndpoint
            }),
        }
    )
)