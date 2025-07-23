import React, { useState } from 'react';
import { TbCopy } from "react-icons/tb";

export default function User({ message, index }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    console.log('text copied');
  };

  return (
    <div 
      className="mt-4 px-2 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`${index > 0 ? "border-t border-zinc-700/40 mt-6 h-6" : ""}`}></div>
      <div className="max-w-[100%] text-white">
        <p className="text-xl font-[500]">{message.text}</p>
      </div>
      
      {/* copy action */}
      <div className={`absolute bottom-0 right-2 transition-opacity duration-200 ease-in-out ${
        isHovered 
          ? 'opacity-100' 
          : 'opacity-0 pointer-events-none'
      }`}>
        <div className="relative">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
          >
            <TbCopy 
              size={14} 
              className="text-[#a4a4a8]/60 hover:text-[#a4a4a8] transition-colors duration-200" 
            />
          </button>
        </div>
      </div>
    </div>
  );
}
