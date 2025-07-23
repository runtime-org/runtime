import React from 'react';

export default function TabOption({ icon, label, onClick, isActive }) {
  return (
    <div 
      className={`flex flex-col items-center gap-2 rounded-md px-2 py-1 hover:cursor-pointer relative select-none ${isActive ? "" : "hover:bg-zinc-700/20"}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div>{icon}</div>
        <p className={`text-sm font-[500] ${
          isActive ? "text-white" : "text-[#a4a4a8]" 
        }`}>{label}</p>
      </div>
      
      {/* Active indicator bar */}
      <div 
        className={`absolute -bottom-[4px] left-0 w-[75%] ml-[12.5%] h-[2px] ${
          isActive ? "bg-white opacity-100" : "opacity-0"
        } transition-opacity duration-200`}
      />
    </div>
  );
}
