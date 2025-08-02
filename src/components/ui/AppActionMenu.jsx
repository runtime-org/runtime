import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

AppActionMenu.propTypes = {
  visible: PropTypes.bool,
  onRequestClose: PropTypes.func,
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    icon: PropTypes.node,
    onClick: PropTypes.func
  }))
}

export default function AppActionMenu({ visible, onRequestClose, items }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onRequestClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onRequestClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full mb-2 
                 w-48 rounded-lg border border-[#484848]/60
                 bg-[#1e1e1e]/80 backdrop-blur p-1 flex flex-col shadow-lg"
    >
      {items.map((item, idx) => (
        <div key={item.id}>
          <button
            onClick={item.onClick}
            className="flex items-center gap-2 px-2 py-1 rounded-md w-full
                       hover:bg-[#ffffff]/5 transition-colors text-left"
          >
            {item.icon}
            <span className="text-xs leading-none text-[#a4a4a8]">{item.label}</span>
          </button>

          {idx < items.length - 1 && (
            <div className="h-px mx-2 bg-[#484848]/40" />
          )}
        </div>
      ))}
    </div>
  );
}
