import React, { useState } from 'react';
import { TbCopy } from "react-icons/tb";

export default function User({ message, index }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    console.log('text copied');
  };

  return (
    <div className="mt-4 px-2 relative">
      <div className={`${index > 0 ? "border-t border-zinc-700/40 mt-6 h-6" : ""}`}></div>
      <div className="max-w-[100%] text-white">
        <p className="text-xl font-[500]">{message.text}</p>
      </div>
      
      {/* copy action*/}
      <div className="absolute bottom-0 right-2">
        <div className="relative">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <TbCopy 
              size={16} 
              className="text-[#a4a4a8]/60 hover:text-[#a4a4a8] transition-colors duration-200" 
            />
          </button>
          {isHovered && (
            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Copy
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
