import React, { useState } from 'react';
import TabOption from './TabOption';
import PlanIcon from './PlanIcon';
import { TbBrowserShare } from "react-icons/tb";
import PropTypes from 'prop-types';

import Construction from './Construction';
import ParseText from './ParseText';
import ActionIcons from './ActionIcons';

System.propTypes = {
  message: PropTypes.object.isRequired,
  isError: PropTypes.bool,
  isComplete: PropTypes.bool,
  requiresUserInput: PropTypes.bool
};

export default function System({ 
  message, 
  isError = false, 
  isComplete = false, 
  requiresUserInput = false
}) {
  const [activeTab, setActiveTab] = useState('plan');

  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  const getPlanIconState = () => {
    if (isError) return "error";
    if (isComplete) return "completed";
    if (requiresUserInput) return "waiting";
    return "running";
  };

  return ( 
    <div className="mt-4 px-2">
      {/* Plan | Tabs */}
      <div className="flex items-center border-[#484848]/50 h-10 gap-1 relative select-none">
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
          <Construction activeTab={activeTab} tasks={message.tasks} />
          
          {/* Back to simple text display */}
          <div className="mt-3 relative">
            {
              message.text && (
                <>
                  <ParseText text={message.text} />
                  <ActionIcons text={message.text} />
                </>
              )
            }
            
          </div>
        </div>
      )}

      {activeTab === 'tabs' && (
        <Construction activeTab={activeTab} tasks={message.tasks} />
      )}
    </div>
  );
}
