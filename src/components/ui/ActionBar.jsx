import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TbThumbUp, TbThumbDown, TbCopy, TbPlus, TbRotateClockwise } from "react-icons/tb";
import AppActionMenu from './AppActionMenu';
import PropTypes from 'prop-types';



ActionBar.propTypes = {
  text: PropTypes.string,
  onThumbsUp: PropTypes.func,
  onThumbsDown: PropTypes.func,
  onCopy: PropTypes.func,
  onNotion: PropTypes.func,
  onAppleNote: PropTypes.func
};

export default function ActionBar({ 
  text = "", 
  onThumbsUp,
  onThumbsDown,
  onCopy,
}) {
  const [hoveredButton, setHoveredButton] = useState(null);
  const [openMenuFor, setOpenMenuFor] = useState(null);

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
    setOpenMenuFor('apple');
  };

  /* ===== menus for each icon ===== */
  const appleNoteItems = [
    {
      id: 'new',
      label: 'Add to a new note',
      icon: <TbPlus size={16} className="opacity-70 text-[#a4a4a8]" />,
      onClick: async () => {
        setOpenMenuFor(null);
        console.log('Adding to new note: ', text);
        await invoke('call_app', {
          func: 'create_note',
          args: ['Note from Runtime', text]
        });
      }
    },
    {
      id: 'append',
      label: 'Add to the last note',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={16}
          height={16}
          fill="#a4a4a8"
          viewBox="0 0 256 256"
          className="opacity-70"
        >
          <path d="M136,80v43.47l36.12,21.67a8,8,0,0,1-8.24,13.72l-40-24A8,8,0,0,1,120,128V80a8,8,0,0,1,16,0Zm-8-48A95.44,95.44,0,0,0,60.08,60.15C52.81,67.51,46.35,74.59,40,82V64a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16H49c7.15-8.42,14.27-16.35,22.39-24.57a80,80,0,1,1,1.66,114.75,8,8,0,1,0-11,11.64A96,96,0,1,0,128,32Z"></path>
        </svg>
      ),
      onClick: async () => {
        setOpenMenuFor(null);
        console.log('Adding to last note: ', text);
        await invoke('call_app', {
          func: 'append_note',
          args: [text]
        });
      }
    }
  ];

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
            <div className="absolute bottom-full mb-1 left-[40px] -translate-x-1/2
                            bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Send to Apple Notes
            </div>
          )}

          <AppActionMenu
            visible={openMenuFor === 'apple'}
            onRequestClose={() => setOpenMenuFor(null)}
            items={appleNoteItems}
          />
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