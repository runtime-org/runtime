import React, { useState } from 'react';
import { TbThumbUp, TbThumbDown, TbCopy } from "react-icons/tb";
import PropTypes from 'prop-types';

ActionIcons.propTypes = {
  text: PropTypes.string.isRequired,
  onThumbsUp: PropTypes.func,
  onThumbsDown: PropTypes.func,
  onCopy: PropTypes.func
};

export default function ActionIcons({ 
  text, 
  onThumbsUp,
  onThumbsDown,
  onCopy
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

  return (
    <div className="flex items-center gap-2 mt-2 justify-end">
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
  );
} 