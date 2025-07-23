import React from 'react';
import { formatDateString } from "../../lib/utils";
import { useAppState } from "../../hooks/useAppState";
import PropTypes from 'prop-types';

SessionItem.propTypes = {
    session: PropTypes.object.isRequired
}

export default function SessionItem({ session }) {
    const { openSession } = useAppState();
    
    const handleClick = () => {
        openSession(session.id);
    };
    const truncate = (text, maxLength) => {
        return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    }
    
    return (
        <div 
            className="group border-t border-[#484848]/50 relative flex items-center justify-between p-3 hover:!cursor-pointer"
            onClick={handleClick}
        >
            <div className="flex flex-col text-[#9E9E9E]">
                <h3 className="text-lg font-semibold group-hover:text-white/90 transition-colors duration-200">{truncate(session.title, 35)}</h3>
                <p className="text-xs text-[#9E9E9E]">{formatDateString(session.createdAt)}</p>
            </div>
        </div>
    )
}