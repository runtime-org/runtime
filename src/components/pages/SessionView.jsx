import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { v4 as uuidv4 } from 'uuid';

import HeaderBar from '../layout/HeaderBar';
import PromptInput from '../ui/PromptInput';
import User from '../ui/User';
import System from '../ui/System';
import SettingView from '../pages/SettingView';

import { useAppState }  from '../../hooks/useAppState';

import { splitQuery } from '../../lib/query.llm';
import { 
  buildHistoryDigest, 
  addPlanToTask, 
  updatePlanInTask 
} from '../../lib/query.helpers';
import { runWorkflow } from '../../lib/workflow.runner';
import { taskEventEmitter } from '../../lib/emitters';
import puppeteer from 'puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js';
import posthog from '../../lib/posthogSetup';

SessionView.propTypes = {
  browserInstance: PropTypes.object,
  isConnected: PropTypes.bool,
  connectBrowser: PropTypes.func.isRequired
};

export default function SessionView({ browserInstance, isConnected, connectBrowser }) {

  const {
    sessions, 
    runtimeMode,
    activeSessionId, 
    openHome,
    addMessageToSession, 
    getSessionMessages,
    forgetBrowser,
    getWsFor,
    setBrowserInstance,
    setIsConnected,
    currentBrowserPath,
    getPendingPages,
    clearPendingPages
  } = useAppState();

  const activeSession   = sessions.find(s => s.id === activeSessionId);
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [isMessagesReady, setIsMessagesReady] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const messagesEndRef  = useRef(null);
  const cancelRef = useRef({ cancelled: false });
  const settingsMenuRef = useRef(null);

  /*
  ** reattach if we lost the in memory handle
  */
  const reconnectIfNeeded = async (maxRetries = 3) => {

    if (browserInstance) return browserInstance;

    /*
    ** try to reconnect to the browser
    */
    let attempts = 0;
    while (attempts <= maxRetries) {
      const ws = getWsFor(currentBrowserPath);

      if (ws) {
        try {
          const br = await puppeteer.connect({
            browserWSEndpoint: ws,
            defaultViewport: null
          })

          setBrowserInstance(br);
          setIsConnected(true);
          return br;
        } catch (error) {
          /*
          ** if the ws is stale, drop it
          */
          console.log("stale ws, dropping it", error.message);
          forgetBrowser(currentBrowserPath);
        }
      }
      await connectBrowser(currentBrowserPath);

      attempts += 1;
    }

    return null;
  }

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
  ** load the session history on mount, and take the current query
  */
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setHistoryReady(false);
      setIsMessagesReady(false);
      return;
    }

    const stored = getSessionMessages(activeSessionId) ?? [];
    setMessages(stored);
    setHistoryReady(true);
    setIsMessagesReady(true);
  }, [activeSessionId]);


  /*
  ** handle new query
  */
  useEffect(() => {
    if (!isMessagesReady) return;

    if (
      activeSessionId &&
      messages.length === 0 &&
      activeSession?.title 
    ) {

      const handleInitialQuery = async () => {
        const pendingPages = getPendingPages ? getPendingPages() : [];
        
        /*
        ** save the message
        */
        addNewMessage({ type: 'user', text: activeSession.title });

        /*
        ** execute the query with pending pages if available
        */
        if (pendingPages && pendingPages.length > 0) {
          console.log("Executing with pending pages:", pendingPages);
          executeQuery(activeSession.title, pendingPages);
          if (clearPendingPages) clearPendingPages();
        } else {
          executeQuery(activeSession.title);
        }
      };

      handleInitialQuery();
    }
  }, [activeSessionId, messages.length, activeSession?.title, isMessagesReady]);

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
            ...sysMsg, 
            status: 'complete', 
            text: speakToUser,
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
    const handleActionStart = ({ taskId, action, speakToUser, status, actionId, url }) => {

      setMessages(prev => {
        const clone = [...prev];

        let sysIndex = ensureSysMessage(clone, taskId, action);
        let sysMsg = { 
          ...clone[sysIndex]
        };

        const newPlanStep = {
          id: actionId,
          action,
          title: speakToUser,
          status,
          timestamp: new Date().toISOString(),
        };

        sysMsg.tasks = addPlanToTask({tasks: sysMsg.tasks, taskId, newPlan: newPlanStep, action, url});

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
        const sysMsg = { 
          ...clone[sysIndex]
        };

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
  }, [activeSessionId]); // removed isProcessing

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
  * execute a query
  */
  const executeQuery = async (rawText, pages = []) => {

    setIsProcessing(true);
    cancelRef.current.cancelled = false;

    console.log("pages", pages);

    /*
    ** posthog the search
    */
    posthog.capture('search', {
      queryLength: rawText.length,
      pagesLength: pages.length,
      runtimeMode: runtimeMode
    });

    try {
      /*
      * check if pages are provided
      */
      if (pages && pages.length > 0) {
        let browser = browserInstance;
        if (!browser) {
          browser = await reconnectIfNeeded();
        }

        if (!browser) {
          addNewMessage({ 
            type:'system', 
            text: "Ops, something went wrong, please relaunch runtime",
            isError: true
          });
          return;
        }

        await runWorkflow({
          mode: 'tab_query',
          originalQuery: rawText,
          sessionId: activeSessionId,
          browserInstance: browser,
          pages: pages,
          cancelRef,
        });
        
      } else {
        /*
        * classic flow
        */
        const fullHistory = getSessionMessages(activeSessionId) ?? [];
        const historyDigest = buildHistoryDigest(fullHistory);
          console.log("historyDigest", historyDigest);

        const resp = await splitQuery({query: rawText, history: historyDigest, runtimeMode});
        console.log("kind", resp.kind);

        if (resp.kind === "small_talk") {
          const { reply } = resp;
          addNewMessage({ type:'system', text: reply });
          return;
        }

        /*
        * run the workflow
        */
        let browser = browserInstance;
        if (!browser) {
          browser = await reconnectIfNeeded();
        }

        if (!browser) {
          addNewMessage({ 
            type:'system', 
            text: "Ops, something went wrong, please relaunch runtime",
            isError: true
          });
          return;
        }

        await runWorkflow({
          mode: resp.kind,
          originalQuery: rawText,
          sessionId: activeSessionId,
          queries: resp.queries,
          dependencies: resp.dependencies,
          researchFlags: resp.researchFlags,
          steps: resp.steps,
          browserInstance: browser,
          pages: [],
          cancelRef,
        });
      }
    } catch (error) {
      addNewMessage({ type:'system', text: error.message, isError:true });
    } finally {
      setIsProcessing(false);
    }
  }

  /*
  * handle the submit of a new message
  */
  const handleSubmit = async (payload) => {
    const isObj = typeof payload === 'object' && payload !== null;
    const text = isObj ? payload.text : payload;
    const pages = isObj ? payload.pages : undefined;

    if (!text?.trim() || isProcessing) return;

    // run puppeteer function to test, i will a function here
    if (!browserInstance) {
      browserInstance = await reconnectIfNeeded();
    }

    // // use page manager
    // const pageManager = createPagePool({ browser: browserInstance });
    // const page = await pageManager();

    addNewMessage({ type:'user', text: text.trim() });
    
    executeQuery(text.trim(), pages || []);
  };

  /*
  ** handle stop
  */
  const handleStop = () => {
    cancelRef.current.cancelled = true;
    setIsProcessing(false);
  }

  /*
  * click outside detection for settings menu
  */
  useEffect(() => {
    function handleClickOutside(event) {
      if (!showSettingsMenu) return;
      
      if (
        settingsMenuRef.current && 
        !settingsMenuRef.current.contains(event.target)
      ) {
        setShowSettingsMenu(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettingsMenu]);

  /*
  * model selector
  */
  const modelSelectorButton = {
    onClick: () => setShowSettingsMenu(prev => !prev)
  };

  if (!activeSession)
    return <div className="flex items-center justify-center h-full">Loading session…</div>;

  return (
    <div className="flex flex-col h-screen relative">
      <HeaderBar
        title={activeSession.title}
        leftAction={{ icon: 'back', onClick: openHome }}
        rightAction={modelSelectorButton}
      />

      {showSettingsMenu && (
        <div className="absolute top-10 right-4 z-10" ref={settingsMenuRef}>
          <SettingView onClose={() => setShowSettingsMenu(false)} />
        </div>
      )}

      {/* chat pane */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2 no-scrollbar pb-24">
        {messages.map(m =>
          m.type === 'user'
            ? <User key={m.id} message={m} />
            : <System key={m.id} message={m}
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
      <div className="absolute bottom-0 left-0 right-0 z-10 pt-0 bg-[#242424]">
        <PromptInput
          placeholder="Ask follow up"
          onSubmit={handleSubmit}
          disabled={!historyReady}
          isProcessing={isProcessing}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
