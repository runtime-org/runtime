import React from "react";
import PropTypes from "prop-types";

SettingView.propTypes = {
    onClose: PropTypes.func.isRequired,
}

export default function SettingView({ onClose }) {
    const handleBillingClick = () => {
        console.log("Billing clicked");
        onClose();
    };
    
    const handleThemeClick = () => {
        console.log("Theme toggle clicked");
        onClose();
    };
    
    const handleLogoutClick = () => {
        console.log("Logout clicked");
        onClose();
    };
    
    return (
        <div className="bg-[#242424] shadow-lg rounded-md w-42 overflow-hidden text-white border border-[#484848]/50">
            {/* <div className="p-3 border-b border-zinc-800">
                <h3 className="font-medium">Settings</h3>
            </div> */}
            
            <div className="px-2 py-1">
                <button 
                    onClick={handleBillingClick}
                    className="w-full text-left text-sm py-1 px-3 hover:bg-[#323232] rounded transition-colors flex items-center"
                >
                    {/* <span className="material-icons text-sm mr-2">account_balance_wallet</span> */}
                    Billing
                </button>
                
                <button 
                    onClick={handleThemeClick}
                    className="w-full text-left text-sm py-1 px-3 hover:bg-[#323232] rounded transition-colors flex items-center"
                >
                    {/* <span className="material-icons text-sm mr-2">dark_mode</span> */}
                    Theme
                </button>
            </div>
            
            <div className="px-2 py-1 border-t border-[#484848]/50">
                <button 
                    onClick={handleLogoutClick}
                    className="w-full text-left text-sm py-1 px-3 hover:bg-[#323232] rounded transition-colors flex items-center text-red-500"
                >
                    {/* <span className="material-icons text-sm mr-2">logout</span> */}
                    Log out
                </button>
            </div>
        </div>
    );
}
