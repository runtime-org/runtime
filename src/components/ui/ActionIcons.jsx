import React, { useState } from 'react';
import { TbThumbUp, TbThumbDown, TbCopy } from "react-icons/tb";
import PropTypes from 'prop-types';

ActionIcons.propTypes = {
  text: PropTypes.string.isRequired,
  onThumbsUp: PropTypes.func,
  onThumbsDown: PropTypes.func,
  onCopy: PropTypes.func,
  onNotion: PropTypes.func,
  onAppleNote: PropTypes.func
};

export default function ActionIcons({ 
  text, 
  onThumbsUp,
  onThumbsDown,
  onCopy,
  onNotion,
  onAppleNote
}) {
  const [hoveredButton, setHoveredButton] = useState(null);

  const handleThumbsUp = () => {
    if (onThumbsUp) {
      onThumbsUp();
    } else {
      console.log('Thumbs up clicked');
    }
  };

  const handleThumbsDown = () => {
    if (onThumbsDown) {
      onThumbsDown();
    } else {
      console.log('Thumbs down clicked');
    }
  };

  const handleCopy = () => {
    if (onCopy) {
      onCopy(text);
    } else {
      navigator.clipboard.writeText(text);
      console.log('Text copied to clipboard');
    }
  };

  const handleNotion = () => {
    if (onNotion) {
      onNotion(text);
    } else {
      console.log('Send to Notion clicked');
    }
  };

  const handleAppleNote = () => {
    if (onAppleNote) {
      onAppleNote(text);
    } else {
      console.log('Send to Apple Notes clicked');
    }
  };

  return (
    <div className="flex items-center justify-between mt-2">
      {/* Left side buttons */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={handleNotion}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredButton('notion')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <img 
              src="/tools/notion.svg" 
              alt="Notion" 
              className="w-3.5 h-3.5 opacity-40 hover:opacity-100 transition-opacity duration-200"
            />
          </button>
          {hoveredButton === 'notion' && (
            <div className="absolute bottom-full mb-1 left-[40px] transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Send to Notion
            </div>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={handleAppleNote}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredButton('appleNote')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <img 
              src="/tools/apple_note.svg" 
              alt="Apple Notes" 
              className="w-3.5 h-3.5 opacity-40 hover:opacity-100 transition-opacity duration-200"
            />
          </button>
          {hoveredButton === 'appleNote' && (
            <div className="absolute bottom-full mb-1 left-[40px] transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Send to Apple Notes
            </div>
          )}
        </div>
      </div>

      {/* Right side buttons */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={handleThumbsUp}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredButton('helpful')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <TbThumbUp 
              size={14} 
              className="text-[#a4a4a8]/40 hover:text-[#a4a4a8] transition-colors duration-200" 
            />
          </button>
          {hoveredButton === 'helpful' && (
            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Helpful
            </div>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={handleThumbsDown}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredButton('notHelpful')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <TbThumbDown 
              size={14} 
              className="text-[#a4a4a8]/40 hover:text-[#a4a4a8] transition-colors duration-200" 
            />
          </button>
          {hoveredButton === 'notHelpful' && (
            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Not helpful
            </div>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-[#484848]/20 transition-colors duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredButton('copy')}
            onMouseLeave={() => setHoveredButton(null)}
          >
            <TbCopy 
              size={14} 
              className="text-[#a4a4a8]/40 hover:text-[#a4a4a8] transition-colors duration-200" 
            />
          </button>
          {hoveredButton === 'copy' && (
            <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Copy
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 