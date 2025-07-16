// src/components/views/SessionView.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import PropTypes from 'prop-types';

import HeaderBar  from '../layout/HeaderBar';
import PromptInput from '../ui/PromptInput';
import User   from '../ui/User';
import System from '../ui/System';

import { useAppState }  from '../../hooks/useAppState';

import { splitQuery }         from '../../lib/query.splitter';
import { runWorkflow }     from '../../lib/workflow.runner';
import { taskEventEmitter }   from '../../lib/emitters';

SessionView.propTypes = {
  browserInstance: PropTypes.object,
  isConnected: PropTypes.bool
};

export default function SessionView({ browserInstance /* isConnected */ }) {

  const {
    sessions, 
    activeSessionId, 
    openHome,
    addMessageToSession, 
    getSessionMessages
  } = useAppState();

  const activeSession   = sessions.find(s => s.id === activeSessionId);
  const [messages, setMessages]     = useState([]);
  const [isProcessing, setIsProcessing]     = useState(false);

  const messagesEndRef  = useRef(null);

  /*
  * add a new message to the messages array and the session
  */
  const addNewMessage = useCallback((msg) => {
    const full = { id: uuidv4(), timestamp: new Date().toISOString(), ...msg };
    setMessages(prev => [...prev, full]);
    if (activeSessionId) addMessageToSession(activeSessionId, full);
  }, [activeSessionId]);

  /*
  * scroll to the bottom of the chat
  */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  /*
  * load the session history on mount / switch
  */
  useEffect(() => {
    if (!activeSessionId) return setMessages([]);
    setMessages(getSessionMessages(activeSessionId) ?? []);
  }, [activeSessionId]);

  /*
  * handle workflow updates (create, update, complete "plan" of sub tasks)
  */
  useEffect(() => {
    if (!activeSessionId) return;
  
    /*
    ** handle task updates
    */
    const handleTaskUpdate = ({ taskId, action, speakToUser, status}) => {
      setMessages(prev => {
        /* 
        ** create a new system message
        */
        const clone = [...prev];
        let sysMsg = clone.find(m => m.type === 'system' && m.tasks);
        const msgId = uuidv4();

        if (!sysMsg) {
          sysMsg = {
            id: msgId,
            type: 'system',
            text: '---',
            action,
            timestamp: new Date().toISOString(),
            status: 'pending',
            tasks: []
          };
          clone.push(sysMsg);
        } else {
          /*
          ** deep clone the system message to avoid mutations
          */
          sysMsg = {
            ...sysMsg,
            tasks: sysMsg.tasks.map(t => ({ 
              ...t,
              plans: [...t.plans]
            }))
          };
          
          const sysIndex = clone.findIndex(m => m.type === 'system' && m.tasks);
          clone[sysIndex] = sysMsg;
        }

        /*
        ** locate or make the specific task
        */
        let task = sysMsg.tasks.find(t => t.taskId === taskId);
        if (!task) {
          task = {
            taskId,
            tabs: [],
            plans: []
          };
          sysMsg.tasks.push(task);
        }

        /*
        ** insert the first plan
        */
        if (status === 'initial') {
          task.plans.push({
            id: uuidv4(),
            action,
            title: speakToUser ?? action,
            status: 'pending',
            timestamp: new Date().toISOString()
          });
          sysMsg.tasks = [...sysMsg.tasks];
        }

        /*
        ** update the zustand message
        */
        addMessageToSession(activeSessionId, sysMsg);

        return clone;
      })
    }

    /*
    * starting the action (puppeteer or llm)
    */
    const handleActionStart = ({ taskId, action, speakToUser, actionId }) => {
      setMessages(prev => {
        const clone = [...prev];
        let sys = clone.find(m => m.type === 'system' && m.tasks);
        if (!sys) return prev;

        /*
        ** deep clone the system message to avoid mutations
        */
        sys = {
          ...sys,
          tasks: sys.tasks.map(t => ({ ...t, plans: [...t.plans] }))
        };

        const sysIndex = clone.findIndex(m => m.type === 'system' && m.tasks);
        clone[sysIndex] = sys;

        /*
        ** locate or make the specific task
        */
        const task = sys.tasks.find((t) => t.taskId === taskId);
        if (!task) return prev;

        const planTitle = action === '__thinking__' ? speakToUser : speakToUser;

        const plan = {
          id: actionId,
          action,
          title: planTitle,
          status: 'running',
          timestamp: new Date().toISOString()
        };
        task.plans.push(plan);
        sys.tasks = [...sys.tasks];

        addMessageToSession(activeSessionId, sys, true);
        
        return clone;
      });
    };

    /*
    * finished or errored the action (puppeteer or llm)
    */
    const handleActionDone = ({ taskId, status, error, actionId }) => {
      setMessages(prev => {
        const clone = [...prev];
        let sys = clone.find(m => m.type === 'system' && m.tasks);
        if (!sys) return prev;

        /*
        ** deep clone the system message to avoid mutations
        */
        sys = {
          ...sys,
          tasks: sys.tasks.map(t => ({ ...t, plans: [...t.plans] }))
        };

        const sysIndex = clone.findIndex(m => m.type === 'system' && m.tasks);
        clone[sysIndex] = sys;

        /*
        ** locate or make the specific task
        */
        const task = sys.tasks.find((t) => t.taskId === taskId);
        if (!task) return prev;

        const plan = task.plans.find((p) => p.id === actionId);
        if (!plan) return prev;

        plan.status = status === 'success' ? 'completed' : 'error';
        if (error) plan.error = error;

        sys.tasks = [...sys.tasks];

        addMessageToSession(activeSessionId, sys, true);

        return clone;
      });
    };

    taskEventEmitter.on('workflow_update', handleTaskUpdate);
    taskEventEmitter.on('task_action_start', handleActionStart);
    taskEventEmitter.on('task_action_complete', handleActionDone);
    taskEventEmitter.on('task_action_error', handleActionDone);

    return () => {
      taskEventEmitter.off('workflow_update', handleTaskUpdate);
      taskEventEmitter.off('task_action_start', handleActionStart);
      taskEventEmitter.off('task_action_complete', handleActionDone);
      taskEventEmitter.off('task_action_error', handleActionDone);
    };
  }, [setMessages, activeSessionId, addMessageToSession]);

  /*
  * execute a query
  */
  const executeQuery = async (rawText) => {
    setIsProcessing(true);

    try {
      /* 
      * analyze and split the query into sub queries if necessary
      */
      const resp  = await splitQuery(rawText);
      const { queries, dependencies } = resp;

      /*
      * run the workflow
      */
      await runWorkflow({
        originalQuery: rawText,
        sessionId: activeSessionId,
        queries,
        dependencies,
        browserInstance,
        onDone: (text) => addNewMessage({ type:'system', text }),
        onError: (err) => addNewMessage({ type:'system', text: err, isError:true })
      })
    } catch (error) {
      addNewMessage({ type:'system', text: error.message, isError:true });
    } finally {
      setIsProcessing(false);
    }
  }

  /*
  * handle the submit of a new message
  */
  const handleSubmit = (text) => {
    if (!text.trim() || isProcessing) return;

    addNewMessage({ type:'user', text: text.trim() });
    executeQuery(text.trim());
  };

  /*
  * if no active session, show a loading message
  */
  if (!activeSession)
    return <div className="flex items-center justify-center h-full">Loading session…</div>;

  return (
    <div className="flex flex-col h-screen relative">
      <HeaderBar
        title={activeSession.title}
        leftAction={{ icon: 'back', onClick: openHome }}
      />

      {/* chat pane */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2 no-scrollbar pb-24">
        {messages.map(m =>
          m.type === 'user'
            ? <User key={m.id}    message={m} />
            : <System key={m.id}  message={m}
                      isError={m.isError}
                      isComplete={m.isComplete}
                      isParallelWorkflow={m.isParallelWorkflow}
                      workflowInfo={m.workflowInfo} />
        )}
        {isProcessing && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Runtime is working…</span>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      {/* input */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-2 pt-0 bg-[#242424]">
        <PromptInput
          placeholder={isProcessing ? 'Runtime is working…' : 'Send a message to Runtime…'}
          onSubmit={handleSubmit}
          disabled={isProcessing}
        />
      </div>
    </div>
  );
}
