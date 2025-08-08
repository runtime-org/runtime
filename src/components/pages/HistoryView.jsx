import React,{ useState, useRef, useEffect } from 'react';
import IconButton from "../ui/IconButton";
import SessionList from "../ui/SessionList";
import { useAppState } from "../../hooks/useAppState";
import SessionMenu from "../ui/SessionMenu";
import { HiTrash } from "react-icons/hi2";
import ConfirmModal from '../ui/ConfirmModal';
import posthog from '../../lib/posthogSetup';

const version = "0.1.0";

export default function HistoryView() {
    const { openHome, sessions, clearSessions } = useAppState();
    const [showMenu, setShowMenu] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const menuButtonRef = useRef(null);
    const menuDropdownRef = useRef(null);

    // 
    useEffect(() => {
        function handleClickOutside(event) {
            // only hide menu if click is outside both the button and dropdown
            const isOutsideButton = menuButtonRef.current && !menuButtonRef.current.contains(event.target);
            const isOutsideDropdown = menuDropdownRef.current && !menuDropdownRef.current.contains(event.target);
            
            if (isOutsideButton && isOutsideDropdown) {
                setShowMenu(false);
            }
        }
        
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleMenuToggle = () => {
        setShowMenu(!showMenu);
    };

    const handleClearSessions = () => {
        setShowConfirmModal(true);
        setShowMenu(false);
        posthog.capture('delete_all_sessions', { version });
    };

    return (
        <>
            <header className="h-12 min-h-12 max-h-12 flex items-center justify-between px-2 border-b
                       border-[#484848]/70 backdrop-blur
            ">
                <IconButton icon="back" label="Back" onClick={openHome} />
                <h1 className="text-lg font-medium text-white">History</h1>
                <div className="relative" ref={menuButtonRef}>
                    <SessionMenu onMenuToggle={handleMenuToggle} />
                </div>
            </header>

            <SessionList sessions={sessions} emptyLabel="No previous sessions" />

            {showMenu && (
                <div 
                    ref={menuDropdownRef}
                    className="absolute right-0 mt-10 mr-2 w-48 bg-[#242424] rounded-lg shadow-lg border border-[#484848]/50 p-1 hover:cursor-pointer z-10"
                >
                    <div
                        onClick={handleClearSessions}
                        className="w-full rounded px-4 py-2 text-left text-red-500 hover:bg-[#323232] flex items-center gap-2"
                    >
                        <HiTrash className="w-4 h-4" />
                        Clear All Sessions
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 bg-[#1C1C1E]/50 flex items-center justify-center z-50">
                    <ConfirmModal
                        message="Are you sure you want to clear all sessions? This action cannot be undone."
                        onConfirm={() => {
                            clearSessions();
                            setShowConfirmModal(false);
                        }}
                        onCancel={() => {
                            setShowConfirmModal(false);
                            console.log("cancel");
                        }}
                    />
                </div>
            )}
        </>
    );
}