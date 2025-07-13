import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useAppState } from "../../hooks/useAppState";
import { useTaskState } from "../../hooks/useTaskState";
import HeaderBar from "../layout/HeaderBar";
import PromptInput from "../ui/PromptInput";
import User from "../ui/User";
import System from "../ui/System";
import PropTypes from "prop-types";
import { createTaskExecutor } from "../../legacy/tasks";
import { attemptFullBrowserReconnection } from "../../legacy/pptr_utils";
import { taskEventEmitter } from "../../legacy/emitters";

SessionView.propTypes = {
    pageInstance: PropTypes.object,
    browserInstance: PropTypes.object,
    isConnected: PropTypes.bool,
}

export default function SessionView({ pageInstance, browserInstance, isConnected }) {
    const { 
        addMessageToSession,
        getSessionMessages,
        sessions,
        openHome,
        activeSessionId,
        selectedBrowserPath,
        setSavedWsEndpoint,
        clearSavedWsEndpoint,
        setBrowserInstance,
        setPageInstance,
        setIsConnected
    } = useAppState();

    const {
        addTask,
        updateTask,
        getTask,
        // eslint-disable-next-line no-unused-vars
        removeTask
    } = useTaskState();

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const [messages, setMessages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState(null);
    const [taskExecutor, setTaskExecutor] = useState(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
    const messagesEndRef = useRef(null);

    const initialTaskStartedRef = useRef(new Set());

    useEffect(() => {
        if (!pageInstance || !browserInstance || !isConnected) return;

        const executor = createTaskExecutor({
            onStateUpdate: ({ taskId, taskData, action }) => {
                if (action === 'CREATE_TASK') {
                    addTask(taskId, taskData);
                } else if (action === 'UPDATE_TASK') {
                    updateTask(taskId, taskData);
                } else if (action === 'COMPLETE_TASK') {
                    updateTask(taskId, { status: 'completed' });
                }
            },
            getTaskData: (taskId) => getTask(taskId),
            modelName: 'gemini-2.5-flash',
            browserInstance: browserInstance,
            pageInstance: pageInstance
        });

        setTaskExecutor(executor);
    }, [pageInstance, browserInstance, isConnected, addTask, updateTask, getTask]);

    // Message handlers
    const addNewMessage = useCallback((messageData) => {
        const fullMessageData = { 
            id: messageData.id || uuidv4(), 
            timestamp: new Date().toISOString(),
            ...messageData 
        };
        setMessages(prev => [...prev, fullMessageData]);
        if (activeSessionId) {
            addMessageToSession(activeSessionId, fullMessageData);
        }
    }, [activeSessionId, addMessageToSession]);

    const updateMessageByTaskId = useCallback((taskId, updateData) => {
        setMessages(prev => prev.map(msg => {
            if (msg.taskId === taskId && msg.type === 'system') {
                const updatedMessage = { ...msg, ...updateData };
                if (activeSessionId) {
                    addMessageToSession(activeSessionId, updatedMessage, true);
                }
                return updatedMessage;
            }
            return msg;
        }));
    }, [activeSessionId, addMessageToSession]);

    // Scroll handling
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(scrollToBottom, [messages]);

    // Load session messages
    useEffect(() => {
        if (activeSessionId) {
            const saved = getSessionMessages(activeSessionId);
            setMessages(saved || []); 
        } else {
            setMessages([]); 
        }
    }, [activeSessionId]);

    // Browser reconnection handler
    const handleBrowserReconnection = useCallback(async () => {
        if (isReconnecting) return;
        
        setIsReconnecting(true);
        const currentAttempt = reconnectionAttempts + 1;
        setReconnectionAttempts(currentAttempt);

        const reconnectionTaskId = `reconnection-${Date.now()}`;
        
        addNewMessage({
            type: 'system',
            text: `🔄 Attempting to reconnect to browser... (Attempt ${currentAttempt})`,
            taskId: reconnectionTaskId,
            isReconnecting: true
        });

        try {
            const result = await attemptFullBrowserReconnection(selectedBrowserPath, {
                onStart: () => console.log("Starting reconnection..."),
                onProgress: (msg) => console.log(`Reconnection progress: ${msg}`),
                onSuccess: () => {
                    updateMessageByTaskId(reconnectionTaskId, {
                        text: "✅ Successfully reconnected to browser!",
                        isSuccess: true,
                        isReconnecting: false
                    });
                },
                onError: (error) => console.error("Reconnection error:", error),
            });

            if (result.success) {
                setSavedWsEndpoint(result.wsEndpoint);
                setIsConnected(true);
                setBrowserInstance(result.browser);
                setPageInstance(result.page);
                
                result.browser.on("disconnected", () => {
                    setBrowserInstance(null);
                    setPageInstance(null);
                    setIsConnected(false);
                    clearSavedWsEndpoint();
                });

                setIsReconnecting(false);
                setReconnectionAttempts(0);

                const newExecutor = createTaskExecutor({
                    onStateUpdate: ({ taskId, taskData, action }) => {
                        if (action === 'CREATE_TASK') {
                            addTask(taskId, taskData);
                        } else if (action === 'UPDATE_TASK') {
                            updateTask(taskId, taskData);
                        } else if (action === 'COMPLETE_TASK') {
                            updateTask(taskId, { status: 'completed' });
                        }
                    },
                    getTaskData: (taskId) => getTask(taskId),
                    modelName: 'gemini-2.5-flash',
                });

                setTaskExecutor(newExecutor);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error("Reconnection failed:", error);
            updateMessageByTaskId(reconnectionTaskId, {
                text: `❌ Reconnection failed: ${error.message}`,
                isError: true,
                isReconnecting: false
            });

            if (currentAttempt < 3) {
                setTimeout(() => handleBrowserReconnection(), 3000);
            } else {
                setIsReconnecting(false);
                setReconnectionAttempts(0);
            }
        }
    }, [isReconnecting, reconnectionAttempts, selectedBrowserPath]);

    // Connection status
    const getConnectionStatus = () => {
        if (isReconnecting) return "reconnecting";
        if (!isConnected || !pageInstance || pageInstance?.isClosed()) {
            return "disconnected";
        }
        return "connected";
    };

    // Set up task event listeners
    useEffect(() => {
        if (!taskExecutor) return;

        // Track active task messages
        const taskMessages = new Map();
        // track active task for completion handling
        const activeTasks = new Map();

        // Listen for task updates
        const handleTaskUpdate = (update) => {
            const { taskId, action, speakToUser, thought, status, isSubTask, parentWorkflowId, parameters } = update;
            // console.log("update ->", update);

            // track active tasks
            if (status === 'initial' && !isSubTask) {
                activeTasks.set(taskId, true);
            }
            // check completion and trigger completion callback
            if (action ==="done" && action === "error") {
                if (activeTasks.has(taskId)) {
                    activeTasks.delete(taskId);
                    if (taskId === currentTaskId) {
                        setIsProcessing(false);
                        setCurrentTaskId(null);
                    }
                }
            }
            
            // display text for the main message
            const getDisplayText = () => {
                if (action === 'done' && parameters?.text) {
                    return parameters.text;
                } else if (action === 'error' && parameters?.message) {
                    return parameters.message;
                } else {
                    return speakToUser || action;
                }
            }
            // plan title
            const getPlanTitle = () => {
                if (action === 'done') {
                    return "Task complete successfully";
                } else if (action === 'error') {
                    return parameters?.message || "Task failed";
                } else {
                    return action || speakToUser;
                }
            }

            const displayText = getDisplayText();
            const planTitle = getPlanTitle();
            
            // Check if we need to update parent workflow
            if (isSubTask && parentWorkflowId) {
                setMessages(currentMessages => {
                    const parentMessage = currentMessages.find(msg => msg.taskId === parentWorkflowId && msg.type === 'system');
                    if (parentMessage && parentMessage.isParallelWorkflow) {
                        const subTaskPlan = {
                            id: uuidv4(),
                            action: action,
                            title: planTitle,
                            thought: thought,
                            timestamp: new Date().toISOString(),
                            status: 'running',
                            isSubTask: true,
                            taskId: taskId
                        };
                        
                        const updatedPlans = [...(parentMessage.plans || []), subTaskPlan];
                        
                        return currentMessages.map(msg => 
                            msg.taskId === parentWorkflowId && msg.type === 'system'
                                ? { ...msg, plans: updatedPlans }
                                : msg
                        );
                    }
                    return currentMessages;
                });
            }
            
            // Update or create the task message
            setMessages(currentMessages => {
                let existingMessage = currentMessages.find(msg => msg.taskId === taskId && msg.type === 'system');
                
                if (status === 'initial' || !existingMessage) {
                    // Create new system message with initial plan
                    const newMessage = {
                        id: uuidv4(),
                        type: 'system',
                        text: displayText,
                        taskId: taskId,
                        thought: thought,
                        isComplete: action === 'done',
                        isError: action === 'error',
                        requiresUserInput: action === 'ask_user',
                        isSubTask: isSubTask,
                        parentWorkflowId: parentWorkflowId,
                        plans: [{
                            id: uuidv4(),
                            action: action,
                            title: planTitle,
                            thought: thought,
                            timestamp: new Date().toISOString(),
                            status: 'pending'
                        }],
                        timestamp: new Date().toISOString()
                    };
                    
                    taskMessages.set(taskId, newMessage.id);
                    
                    // return [...currentMessages, newMessage];
                    addNewMessage(newMessage);
                    
                    return currentMessages;
                } else {
                    // Add new plan to existing message
                    const newPlan = {
                        id: uuidv4(),
                        action: action,
                        title: planTitle,
                        thought: thought,
                        timestamp: new Date().toISOString(),
                        status: 'pending'
                    };
                    
                    const updatedPlans = [...(existingMessage.plans || []), newPlan];
                    
                    const updatedMessage = {
                        ...existingMessage,
                        plans: updatedPlans, 
                        text: displayText,
                        isComplete: action === 'done',
                        isError: action === 'error',
                        requiresUserInput: action === 'ask_user'
                    };
                    
                    // Save updated message to Zustand
                    if (activeSessionId) {
                        addMessageToSession(activeSessionId, updatedMessage, true);
                    }
                    
                    return currentMessages.map(msg => 
                        msg.taskId === taskId && msg.type === 'system' 
                            ? updatedMessage
                            : msg
                    );
                }
            });
        };

        // Listen for action start events
        const handleActionStart = ({ taskId, action }) => {
            setMessages(currentMessages => {
                const existingMessage = currentMessages.find(msg => msg.taskId === taskId && msg.type === 'system');
                if (existingMessage && existingMessage.plans) {
                    const updatedPlans = [...existingMessage.plans];
                    const lastPlan = updatedPlans[updatedPlans.length - 1];
                    if (lastPlan && lastPlan.action === action) {
                        lastPlan.status = 'running';
                        
                        return currentMessages.map(msg => 
                            msg.taskId === taskId && msg.type === 'system' 
                                ? { ...msg, plans: updatedPlans }
                                : msg
                        );
                    }
                }
                return currentMessages;
            });
        };

        // Listen for action complete events
        const handleActionComplete = ({ taskId, action, status, error }) => {
            setMessages(currentMessages => {
                const existingMessage = currentMessages.find(msg => msg.taskId === taskId && msg.type === 'system');
                if (existingMessage && existingMessage.plans) {
                    const updatedPlans = [...existingMessage.plans];
                    const matchingPlan = updatedPlans.find(p => p.action === action && p.status === 'running');
                    if (matchingPlan) {
                        matchingPlan.status = status === 'success' ? 'completed' : 'error';
                        if (error) {
                            matchingPlan.error = error;
                        }
                        
                        return currentMessages.map(msg => 
                            msg.taskId === taskId && msg.type === 'system' 
                                ? { ...msg, plans: updatedPlans }
                                : msg
                        );
                    }
                }
                return currentMessages;
            });
        };

        // Listen for workflow events
        const handleWorkflowUpdate = (event) => {
            if (event.action === 'CREATE_WORKFLOW') {
                const workflowId = event.workflowId;
                
                addNewMessage({
                    type: 'system',
                    text: `Starting parallel research with ${event.workflow.metadata.totalTasks} tasks`,
                    taskId: workflowId,
                    isParallelWorkflow: true,
                    workflowInfo: event.workflow
                });
                
                // Set up synthesis event listeners for this workflow
                const handleSynthesisComplete = (result) => {
                    console.log(`Workflow synthesis completed for ${workflowId}:`, result);
                    updateMessageByTaskId(workflowId, {
                        text: result.finalResult || result.synthesizedAnswer || 'Research synthesis completed',
                        isComplete: true,
                        synthesisComplete: true
                    });
                };
                
                const handleSynthesisError = (error) => {
                    console.error(`Workflow synthesis error for ${workflowId}:`, error);
                    updateMessageByTaskId(workflowId, {
                        text: `Synthesis failed: ${error.error || error.message || 'Unknown error'}`,
                        isError: true
                    });
                };
                
                // Listen for synthesis events
                taskEventEmitter.once(`workflow_synthesis_completed_${workflowId}`, handleSynthesisComplete);
                taskEventEmitter.once(`workflow_synthesis_error_${workflowId}`, handleSynthesisError);
                
                // Clean up listeners when component unmounts or workflow changes
                const cleanup = () => {
                    taskEventEmitter.off(`workflow_synthesis_completed_${workflowId}`, handleSynthesisComplete);
                    taskEventEmitter.off(`workflow_synthesis_error_${workflowId}`, handleSynthesisError);
                };
                
                // Store cleanup function
                if (!window._workflowCleanups) window._workflowCleanups = new Map();
                window._workflowCleanups.set(workflowId, cleanup);
                
            } else if (event.action === 'UPDATE_WORKFLOW') {
                updateMessageByTaskId(event.workflowId, {
                    workflowInfo: event.workflow
                });
            } else if (event.action === 'COMPLETE_WORKFLOW') {
                updateMessageByTaskId(event.workflowId, {
                    isComplete: !event.workflow.synthesisResult,
                    text: event.workflow.synthesisResult 
                        ? 'Synthesizing research results...' 
                        : `Research completed with ${event.workflow.metadata.completedCount} successful tasks`
                });
            }
        };

        // Listen for sub-task events
        const handleSubTaskUpdate = (event) => {
            // eslint-disable-next-line no-unused-vars
            const { workflowId, subTaskId, actualTaskId, action, status, error } = event;
            
            setMessages(currentMessages => {
                const workflowMessage = currentMessages.find(msg => msg.taskId === workflowId && msg.type === 'system');
                if (workflowMessage && workflowMessage.workflowInfo) {
                    const updatedWorkflowInfo = { ...workflowMessage.workflowInfo };
                    if (updatedWorkflowInfo.subTasks && updatedWorkflowInfo.subTasks[subTaskId]) {
                        if (action === 'START_SUB_TASK') {
                            updatedWorkflowInfo.subTasks[subTaskId].status = 'running';
                            updatedWorkflowInfo.subTasks[subTaskId].actualTaskId = actualTaskId;
                        } else if (action === 'COMPLETE_SUB_TASK') {
                            updatedWorkflowInfo.subTasks[subTaskId].status = 'completed';
                            updatedWorkflowInfo.metadata.completedCount = (updatedWorkflowInfo.metadata.completedCount || 0) + 1;
                        } else if (action === 'SUB_TASK_ERROR') {
                            updatedWorkflowInfo.subTasks[subTaskId].status = 'failed';
                            updatedWorkflowInfo.subTasks[subTaskId].error = error;
                            updatedWorkflowInfo.metadata.failedCount = (updatedWorkflowInfo.metadata.failedCount || 0) + 1;
                        }
                    }
                    
                    updateMessageByTaskId(workflowId, {
                        workflowInfo: updatedWorkflowInfo
                    });
                    
                    return currentMessages.map(msg => 
                        msg.taskId === workflowId && msg.type === 'system' 
                            ? { ...msg, workflowInfo: updatedWorkflowInfo }
                            : msg
                    );
                }
                return currentMessages;
            });
        };

        // Subscribe to events
        taskEventEmitter.on('task_update', handleTaskUpdate);
        taskEventEmitter.on('task_action_start', handleActionStart);
        taskEventEmitter.on('task_action_complete', handleActionComplete);
        taskEventEmitter.on('task_action_error', handleActionComplete);
        taskEventEmitter.on('workflow_update', handleWorkflowUpdate);
        taskEventEmitter.on('sub_task_update', handleSubTaskUpdate);

        return () => {
            taskEventEmitter.off('task_update', handleTaskUpdate);
            taskEventEmitter.off('task_action_start', handleActionStart);
            taskEventEmitter.off('task_action_complete', handleActionComplete);
            taskEventEmitter.off('task_action_error', handleActionComplete);
            taskEventEmitter.off('workflow_update', handleWorkflowUpdate);
            taskEventEmitter.off('sub_task_update', handleSubTaskUpdate);
            
            // Clean up any workflow synthesis listeners
            if (window._workflowCleanups) {
                window._workflowCleanups.forEach(cleanup => cleanup());
                window._workflowCleanups.clear();
            }
        };
    }, [taskExecutor]);

    // Process initial query
    useEffect(() => {
        if (!taskExecutor || !activeSession?.title) return;

        const currentMessages = getSessionMessages(activeSessionId);
        
        if (currentMessages.length === 0 && 
            !isProcessing && !currentTaskId && 
            !initialTaskStartedRef.current.has(activeSessionId)
        ) {
            initialTaskStartedRef.current.add(activeSessionId);
            
            const timer = setTimeout(async () => {
                const initialUserMessage = { 
                    type: 'user', 
                    text: activeSession.title 
                };
                
                addNewMessage(initialUserMessage);
                setIsProcessing(true);

                try {
                    // Check browser connection first
                    if (getConnectionStatus() === "disconnected") {
                        await handleBrowserReconnection();
                        return;
                    }

                    const llmAction = await taskExecutor.startTask({
                        query: activeSession.title,
                        sessionId: activeSessionId,
                        currentUrl: pageInstance?.url() || null,
                        pageContext: null,
                        onComplete: (data) => {
                            console.log("Task completed:", data);
                            setIsProcessing(false);
                            setCurrentTaskId(null);
                        },
                        onError: (error) => {
                            console.error("Error detected in task:", error);
                            addNewMessage({
                                type: 'system',
                                text: `Error: ${error.error || error.message || error}`,
                                isError: true
                            });
                            setIsProcessing(false);
                            setCurrentTaskId(null);
                        },
                        onWorkflowComplete: (workflow) => {
                            updateMessageByTaskId(workflow.workflowId, {
                                text: `Research completed with ${workflow.metadata.completedCount} successful tasks`,
                                isComplete: true
                            });
                        }
                    });

                    if (llmAction) {
                        setCurrentTaskId(llmAction.taskId);
                    }
                } catch (error) {
                    console.error("Error starting task:", error);
                    addNewMessage({
                        type: 'system',
                        text: `Error: ${error.message}`,
                        isError: true
                    });
                    setIsProcessing(false);
                    initialTaskStartedRef.current.delete(activeSessionId);
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [activeSessionId, activeSession?.title, taskExecutor, isProcessing, currentTaskId, getSessionMessages, addNewMessage, pageInstance, getConnectionStatus, handleBrowserReconnection, updateMessageByTaskId]);
    
    // Clean up ref when switching sessions
    useEffect(() => {
        return () => {
            if (initialTaskStartedRef.current.size > 10) {
                const currentId = activeSessionId;
                initialTaskStartedRef.current.clear();
                if (currentId) {
                    initialTaskStartedRef.current.add(currentId);
                }
            }
        };
    }, [activeSessionId]);

    // Handle user input
    const handleSubmit = async (text) => {
        if (!text.trim() || isProcessing || !taskExecutor) return;

        addNewMessage({
            type: 'user',
            text: text.trim()
        });

        setIsProcessing(true);

        try {
            // Check browser connection
            if (getConnectionStatus() === "disconnected") {
                await handleBrowserReconnection();
                return;
            }

            const llmAction = await taskExecutor.startTask({
                query: text.trim(),
                sessionId: activeSessionId,
                currentUrl: pageInstance?.url() || null,
                pageContext: null,
                onComplete: () => {
                    setIsProcessing(false);
                },
                onError: (error) => {
                    console.error("Task error:", error);
                    addNewMessage({
                        type: 'system',
                        text: `Error: ${error.error || error.message || error}`,
                        isError: true
                    });
                    setIsProcessing(false);
                }
            });

            if (llmAction) {
                setCurrentTaskId(llmAction.taskId);
            }
        } catch (error) {
            console.error("Error processing request:", error);
            addNewMessage({
                type: 'system',
                text: `Error: ${error.message}`,
                isError: true
            });
            setIsProcessing(false);
        }
    };

    // Render
    if (!activeSession) {
        return <div className="flex items-center justify-center h-full">Loading session...</div>;
    }

    return (
        <div className="flex flex-col h-screen relative">
            <HeaderBar
                title={activeSession.title}
                leftAction={{ icon: "back", onClick: openHome }}
            />
            
            {/* Connection Status */}
            {getConnectionStatus() === "disconnected" && !isReconnecting && (
                <div className="mx-4 my-2 max-w-fit flex items-center space-x-3 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/5">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 8v4m0 4h.01" />
                    </svg>
                    <div className="flex flex-col">
                        <span className="text-sm text-red-500 font-medium">Browser connection lost</span>
                        <button 
                            onClick={handleBrowserReconnection}
                            className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
                        >
                            Click to reconnect
                        </button>
                    </div>
                </div>
            )}
            
            {isReconnecting && (
                <div className="mx-4 my-2 max-w-fit flex items-center space-x-3 px-4 py-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                    </div>
                    <span className="text-sm text-yellow-500 font-medium">
                        Reconnecting to browser... (Attempt {reconnectionAttempts})
                    </span>
                </div>
            )}
            
            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-2 no-scrollbar pb-24">
                {messages.map((message) => (
                    message.type === 'user' ? (
                        <User key={message.id} message={message} />
                    ) : (
                        <System 
                            key={message.id} 
                            message={message}
                            isError={message.isError}
                            isComplete={message.isComplete}
                            requiresUserInput={message.requiresUserInput}
                            isParallelWorkflow={message.isParallelWorkflow}
                            workflowInfo={message.workflowInfo}
                        />
                    )
                ))}
                
                {isProcessing && (
                    <div className="flex items-center space-x-2 p-2 text-sm text-gray-500">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.15s'}}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
                        <span>Runtime is working...</span>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-2 pt-0 bg-[#242424]"> 
                <PromptInput
                    placeholder={
                        isProcessing 
                            ? "Runtime is working..." 
                            : isReconnecting
                                ? "Reconnecting to browser..."
                                : getConnectionStatus() === "disconnected"
                                    ? "Browser disconnected - click above to reconnect"
                                    : "Send a message to runtime..."
                    }
                    onSubmit={handleSubmit}
                    disabled={isProcessing || isReconnecting}
                />
            </div>
        </div>
    );
}