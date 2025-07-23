import React, { useEffect, useRef, useState, useMemo } from "react";
import { HiOutlineGlobeAlt } from 'react-icons/hi2';
import { FiArrowUpRight, FiSearch } from 'react-icons/fi';
import { BiLoader } from 'react-icons/bi';
import { MdDone, MdError, MdPause } from 'react-icons/md';
import PropTypes from 'prop-types';

Construction.propTypes = {
  activeTab: PropTypes.string.isRequired,
  tasks: PropTypes.array,
};

export default function Construction({ activeTab, tasks = [] }) {
  const linkRefs = useRef({});
  const scrollRef = useRef(null);
  const [isTabVisible, setIsTabVisible] = useState(false);

  const totalPlans = useMemo(
    () => tasks.reduce((n, t) => n + (t.plans?.length || 0), 0),
    [tasks]
  );

  /*
  ** ensure the tab is visible
  */
  useEffect(() => {
    if (activeTab === "plan") {
      setIsTabVisible(false);
      const timer = setTimeout(() => setIsTabVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  /*
  ** scroll to the bottom of the plans
  */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [totalPlans]);

  /*
  ** ensure the plans are appeared
  */
  const [appearedPlans, setAppearedPlans] = useState(new Set());

  /*
  ** ensure the plans are appeared
  */
  useEffect(() => {
    const unseen = [];
    tasks.forEach(t =>
      t.plans?.forEach(p => {
        if (!appearedPlans.has(p.id)) unseen.push(p.id);
      })
    );

    if (!unseen.length) return;

    const id = setTimeout(() => {
      setAppearedPlans(prev => {
        const next = new Set(prev);
        unseen.forEach(u => next.add(u)); 
        return next;
      });
    }, 10);
    return () => clearTimeout(id);
  }, [tasks, appearedPlans]);

  /*
  ** get the status icon
  */
  const statusIcon = (s) => ({
      completed: <MdDone className="w-2 h-2 text-green-400" />,
      error:     <MdError className="w-2 h-2 text-red-400" />,
      running:   <BiLoader className="w-2 h-2 text-blue-400 animate-spin" />,
      waiting:   <MdPause className="w-2 h-2 text-yellow-400" />,
    })[s] ?? null;

  /*
  ** get the status dot
  */
  const statusDot = (s) =>
    ({
      completed: "bg-green-400",
      error:     "bg-red-400",
      running:   "bg-blue-400",
      waiting:   "bg-yellow-400",
    })[s] ?? "bg-zinc-700";

  /*
  ** render the plan time line
  */
  const renderPlanTimeLine = (task) => (
    <div className="relative pl-1" key={task.taskId}>
      {task.plans.map((plan, idx) => {
        const isShown = appearedPlans.has(plan.id);
        return (
          <div
            className="flex items-start relative"
            key={plan.id}
            style={{
              opacity: isShown && isTabVisible ? 1 : 0,
              transform: isShown ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 700ms ease-out, transform 700ms ease-out",
            }}
          >
            {/* vertical line */}
            {idx < task.plans.length - 1 && (
              <div className="absolute left-0 top-3 w-[6px] h-full flex items-center justify-center">
                <div className="w-[1px] h-full bg-zinc-700/50" />
              </div>
            )}

            {/* status dot + overlay icon */}
            <div className="relative flex-shrink-0 mt-2">
              <div
                className={`w-1.5 h-1.5 rounded-full z-10 ${statusDot(
                  plan.status,
                )}`}
              />
              {plan.status && plan.status !== "pending" && (
                <div className="absolute -top-1 -left-1 w-3.5 h-3.5 flex items-center justify-center bg-zinc-900 rounded-full border border-zinc-700">
                  {statusIcon(plan.status)}
                </div>
              )}
            </div>

            {/* content */}
            <div className="ml-3 pb-2">
              {/* default action row */}
              {plan.action !== "search_google" && (
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-zinc-400">
                    {plan.title}
                  </h4>
                </div>
              )}

              {/* nice Google search chip */}
              {plan.action === "search_google" && (
                <div className="mt-2 bg-zinc-800/100 border border-zinc-700/20 rounded-lg px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <FiSearch className="w-3 h-3 text-zinc-400/70" />
                    <span className="text-xs text-zinc-400 font-medium truncate">
                      Searching Google
                    </span>
                  </div>
                </div>
              )}

              {plan.timestamp && (
                <p className="text-[10px] text-zinc-600 -mt-0.5">
                  {new Date(plan.timestamp).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );


  /*
  ** render the tab card
  */
  const allTabs = tasks.flatMap((t) => t.tabs || []);
  const renderTabCard = (tab, idx) => (
    <div
      className="flex flex-col bg-zinc-800/20 gap-1 border border-zinc-700/20 hover:border-zinc-700/60 hover:bg-zinc-700/10 transition-colors rounded-md py-3 pl-3 pr-5 relative"
      key={tab.id}
      onClick={() => linkRefs.current[tab.id]?.click()}
    >
      <div className="absolute top-0 left-0 flex items-center justify-between w-full h-5 px-1">
        <span className="text-xs font-medium text-zinc-400">{idx + 1}</span>
        {tab.status && (
          <span className="flex items-center gap-1">
            {statusIcon(tab.status)}
            <span className="text-xs text-zinc-500">{tab.status}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="w-7 h-7 flex items-center justify-center rounded-full overflow-hidden">
          {tab.icon ? (
            <img src={tab.icon} alt={tab.title} className="w-full h-full" />
          ) : (
            <HiOutlineGlobeAlt className="w-7 h-7 text-zinc-400/70" />
          )}
        </div>

        <div className="flex items-center grow max-w-[80%] relative">
          <h3 className="text-sm font-medium text-zinc-300 truncate mb-1">
            {tab.title}
          </h3>

          <div className="flex items-center w-full absolute -bottom-3">
            <FiArrowUpRight className="w-[14px] h-[14px] text-zinc-400" />
            <a
              ref={(el) => (linkRefs.current[tab.id] = el)}
              href={tab.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-300 truncate"
            >
              {tab.url}
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  /*
  ** render the construction
  */
  return (
    <div className="my-2">
      {activeTab === "plan" ? (
        tasks.length ? (
          <div className="relative">
            <div
              ref={scrollRef}
              className="max-h-[200px] overflow-y-auto pr-1 bg-[#202121]/20 border 
                         border-zinc-700/40 rounded-[14px] px-2 py-1"
            >
              {tasks.map(renderPlanTimeLine)}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <BiLoader className="w-3 h-3 animate-spin" />
            <span>Preparing execution plan…</span>
          </div>
        )
      ) : allTabs.length ? (
        <div className="flex flex-col gap-1 mb-4">
          {allTabs.map(renderTabCard)}
        </div>
      ) : (
        <div className="text-xs text-zinc-400 p-3 text-center">
          No browser tabs opened yet
        </div>
      )}
    </div>
  );
}
