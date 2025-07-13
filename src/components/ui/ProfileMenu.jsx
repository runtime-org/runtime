import React, { useState } from 'react';
import SettingView from '../pages/SettingView';

export default function ProfileMenu({ onClose }) {
    const [showSettings, setShowSettings] = useState(false);
    
    const handleProfileClick = () => {
        setShowSettings(true);
    };
    
    if (showSettings) {
        return <SettingView onClose={onClose} />;
    }
    
    return (
        <div className="bg-white shadow-lg rounded-md w-48 overflow-hidden">
            <div className="p-2 border-b">
                <button onClick={handleProfileClick} className="w-full text-left py-2 px-3 hover:bg-gray-100 rounded transition-colors">
                    Profile Settings
                </button>
            </div>
        </div>
    );
} 