import React from "react";
import PropTypes from "prop-types";
import IconButton from "../ui/IconButton";

HeaderBar.propTypes = {
    title: PropTypes.string.isRequired,
    leftAction: PropTypes.object,
    rightAction: PropTypes.object,
}

export default function HeaderBar({ title, leftAction, rightAction }) {
    
    return (
        <header className="h-12 min-h-12 max-h-12 flex items-center justify-betwee px-2 border-b
                       border-[#484848]/70 backdrop-blur relative
            ">
            {
                leftAction ? <IconButton icon={leftAction.icon} onClick={leftAction.onClick} /> : <div className="w-5"></div>
            }
            <h1 className="text-lg font-medium text-white truncate">{title}</h1>
            
            {/* model selector */}
            {/* <div 
                onClick={rightAction?.onClick}
                className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-[#323232] cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
            >
                <span className="text-white text-sm font-medium whitespace-nowrap">
                    {currentModel?.name || 'Gemini'}
                </span>
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="currentColor" 
                    className="w-4 h-4 text-white flex-shrink-0"
                >
                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                </svg>
            </div> */}
        </header>
    )
}