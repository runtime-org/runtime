import React from 'react';

export default function User({ message, index }) {
  return (
    <div className="mt-4 px-2">
      <div className={`${index > 0 ? "border-t border-zinc-700/40 mt-6 h-6" : ""}`}></div>
      <div className="max-w-[100%] text-white">
        <p className="text-xl font-[500]">{message.text}</p>
      </div>
    </div>
  );
}
