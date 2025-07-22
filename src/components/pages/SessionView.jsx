// src/components/views/SessionView.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';

import HeaderBar from '../layout/HeaderBar';
import PromptInput from '../ui/PromptInput';
import User from '../ui/User';
import System from '../ui/System';

import { useAppState }  from '../../hooks/useAppState';

import { splitQuery } from '../../lib/query.llm';
import { callLLM } from '../../lib/llm.engine';
import { getFnCall } from '../../lib/task.execution.helpers';
import { 
  buildHistoryDigest, 
  addPlanToTask, 
  updatePlanInTask 
} from '../../lib/query.helpers';
import { runWorkflow } from '../../lib/workflow.runner';
import { taskEventEmitter } from '../../lib/emitters';

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
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);

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
    if (!activeSessionId) {
      setMessages([]);
      setHistoryReady(false);
      return;
    }

    const stored = getSessionMessages(activeSessionId) ?? [];
    setMessages(stored);
    setHistoryReady(true);

  }, [activeSessionId]);

  /*
  ** ensure sys message is the right one for taskId
  */
  function ensureSysMessage(clone, taskId, initialAction) {
    let idx = clone.findIndex(
      m =>
        m.type === 'system' &&
        Array.isArray(m.tasks) &&
        m.tasks.some(t => t.taskId === taskId)
    );

    if (idx === -1) {
      const newMsg = {
        id: uuidv4(),
        type: 'system',
        text: '',
        action: initialAction,
        timestamp: new Date().toISOString(),
        status: 'pending',
        tasks: [{ taskId, tabs: [], plans: [] }],
      };
      clone.push(newMsg);
      idx = clone.length - 1;
    }

    return idx;
  }

  /*
  * handle workflow updates (create, update, complete "plan" of sub tasks)
  */
  useEffect(() => {
    if (!activeSessionId) return;
  
    /*
    ** handle task updates
    */
    const handleTaskUpdate = ({ taskId, action, speakToUser, status, error}) => {

      setMessages(prev => {
        /* 
        ** create a new system message
        */
        const clone = [...prev];
        let sysIndex = ensureSysMessage(clone, taskId, action);
        let sysMsg = { ...clone[sysIndex] };

        if (status === 'initial') {
          const firstPlan = {
            id: uuidv4(),
            action,
            title: speakToUser ?? action,
            status: 'pending',
            timestamp: new Date().toISOString(),
          };

          sysMsg.tasks = addPlanToTask({tasks: sysMsg.tasks, taskId, newPlan: firstPlan});
          setTimeout(() => addMessageToSession(activeSessionId, sysMsg), 10);
        } else if (status === 'completed') {
          sysMsg = {
            ...sysMsg, status: 'complete', text: speakToUser,
          };
          setTimeout(() => addMessageToSession(activeSessionId, sysMsg, true), 10);
        }
    
        clone[sysIndex] = sysMsg;
        return clone;
      })
    }

    /*
    ** starting the action (puppeteer or llm)
    */
    const handleActionStart = ({ taskId, action, speakToUser, status, actionId }) => {
      setMessages(prev => {
        const clone = [...prev];

        let sysIndex = ensureSysMessage(clone, taskId, action);
        let sysMsg = { ...clone[sysIndex] };

        const newPlanStep = {
          id: actionId,
          action,
          title: speakToUser,
          status,
          timestamp: new Date().toISOString(),
        };

        sysMsg.tasks = addPlanToTask({tasks: sysMsg.tasks, taskId, newPlan: newPlanStep});

        clone[sysIndex] = sysMsg;
        setTimeout(() => {
          addMessageToSession(activeSessionId, sysMsg, true);
        }, 10);
        return clone;
      });
    };

    /*
    ** finished or errored the action (puppeteer or llm)
    */
    const handleActionDone = ({ taskId, status, error, actionId }) => {

      setMessages(prev => {
        const clone  = [...prev];
        const sysIndex = ensureSysMessage(clone, taskId, '');
        const sysMsg = { ...clone[sysIndex] };

        const finalStatus = status === 'success' ? 'completed' : 'error';

        sysMsg.tasks = updatePlanInTask({
          tasks: sysMsg.tasks,
          taskId,
          actionId,
          status: finalStatus,
          error,
        });

        clone[sysIndex] = sysMsg;
        setTimeout(() => {
          addMessageToSession(activeSessionId, sysMsg, true);
        }, 10);
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
  }, [activeSessionId, isProcessing]);

  /*
  * execute a query
  */
  const executeQuery = async (rawText) => {
    setIsProcessing(true);

    try {
      /* 
      * analyze and split the query into sub queries if necessary
      */
      const fullHistory = getSessionMessages(activeSessionId) ?? [];
      const historyDigest = buildHistoryDigest(fullHistory);
      console.log("historyDigest", historyDigest);

      const resp  = await splitQuery({query: rawText, history: historyDigest});
      const { queries, dependencies, researchFlags } = resp;

      /*
      * run the workflow
      */
      await runWorkflow({
        originalQuery: rawText,
        sessionId: activeSessionId,
        queries,
        dependencies,
        researchFlags,
        browserInstance,
        onDone: (text) => addNewMessage({ type:'system', text }),
        onError: (err) => addNewMessage({ type:'system', text: err, isError: true })
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
              />
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
          placeholder={
            !historyReady ? "Loading history…" :
            isProcessing ? "Runtime is working…" :
            "Send a message to Runtime…"
          }
          onSubmit={handleSubmit}
          disabled={isProcessing || !historyReady}
        />
      </div>
    </div>
  );
}
