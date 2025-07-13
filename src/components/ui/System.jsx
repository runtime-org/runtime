import React, { useState, } from 'react';
import TabOption from './TabOption';
import PlanIcon from './PlanIcon';
import { TbBrowserShare } from "react-icons/tb";
import Construction from './Construction';
import PropTypes from 'prop-types';

System.propTypes = {
  message: PropTypes.object.isRequired,
  isError: PropTypes.bool,
  isComplete: PropTypes.bool,
  requiresUserInput: PropTypes.bool,
  isParallelWorkflow: PropTypes.bool,
  workflowInfo: PropTypes.object
};

export default function System({ 
  message, 
  isError = false, 
  isComplete = false, 
  requiresUserInput = false,
  isParallelWorkflow = false,
  workflowInfo = null 
}) {
  const [activeTab, setActiveTab] = useState('plan');

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  // Determine the plan icon state based on message status
  const getPlanIconState = () => {
    if (isError) return "error";
    if (isComplete) return "completed";
    if (requiresUserInput) return "waiting";
    if (isParallelWorkflow) {
      if (workflowInfo?.status === 'completed') return "completed";
      if (workflowInfo?.status === 'running') return "running";
    }
    return "running";
  };

  // Get workflow progress for parallel workflows
  const getWorkflowProgress = () => {
    if (!isParallelWorkflow || !workflowInfo) return null;
    
    const completedTasks = workflowInfo.completedTasks || 0;
    const totalTasks = workflowInfo.totalTasks || 0;
    const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return { completedTasks, totalTasks, percentage };
  };

  const progress = getWorkflowProgress();

  return ( 
    <div className="mt-4 px-2">
      {/* Plan | Tabs */}
      <div className="flex items-center border-[#484848]/50 h-10 gap-1 relative">
        {/* Plan tab */}
        <div className="-ml-2">
          <TabOption
            icon={<PlanIcon state={getPlanIconState()} setState={() => {}} active={activeTab === 'plan'} />}
            label="Plan"
            onClick={() => handleTabClick('plan')}
            isActive={activeTab === 'plan'}
          />
        </div>

        {/* Tabs tab */}
        <TabOption
          icon={<TbBrowserShare
            color={activeTab === 'tabs' ? "#ffffff" : "#a4a4a8"} 
            size={18} 
          />}
          label="Tabs"
          onClick={() => handleTabClick('tabs')}
          isActive={activeTab === 'tabs'}
        />

        {/* Full width line */}
        <div className="absolute left-0 bottom-[2px] w-full h-[1px] bg-[#484848]/30" />
      </div>
      
      {/* Tab content */}
      {activeTab === 'plan' && (
        <div className="">
          <Construction activeTab={activeTab} plans={message.plans} tabs={message.tabs} />
          
          {/* Message text with optional parallel workflow progress */}
          <div className="mt-2">
            {isParallelWorkflow && progress ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#a4a4a8] font-medium">
                    Parallel Research Progress
                  </span>
                  <span className="text-xs text-[#a4a4a8]">
                    {progress.completedTasks}/{progress.totalTasks} tasks
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-zinc-700/30 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
                
                <p className="text-sm text-[#a4a4a8] font-[500]">
                  {message.text}
                </p>

                {/* Show final results when workflow is completed */}
                {workflowInfo?.status === 'completed' && workflowInfo?.finalResult && (
                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="text-xs text-green-400 font-medium mb-2">
                      📄 Final Research Summary:
                    </div>
                    <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      {workflowInfo.finalResult}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#a4a4a8] font-[500]">{message.text}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tabs' && (
        <Construction activeTab={activeTab} plans={message.plans} tabs={message.tabs} />
      )}
    </div>
  );
}
