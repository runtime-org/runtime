import React from "react";
import PropTypes from "prop-types";
import { useAppState } from "../../hooks/useAppState";

SettingView.propTypes = {
    onClose: PropTypes.func.isRequired,
}

export default function SettingView({ onClose }) {
    const { selectedModel, availableModels, setSelectedModel } = useAppState();

    const handleModelSelect = (modelId) => {
        setSelectedModel(modelId);
        console.log("Model selected:", modelId);
        onClose();
    };
    
    return (
    <div className="bg-[#242424] shadow-lg rounded-md w-56 overflow-hidden text-white border border-[#484848]/50">
            {/* Model Selection Section */}
            <div className="px-2 py-1">
                <div className="text-xs text-zinc-400 px-3 py-1">Model</div>
                {availableModels.map((model) => (
                    <button 
                        key={model.id}
                        onClick={() => handleModelSelect(model.id)}
                        className={`w-full text-left text-sm py-2 px-3 hover:bg-[#323232] rounded transition-colors flex items-center justify-between ${
                            selectedModel === model.id ? 'bg-[#323232]' : ''
                        }`}
                    >
                        <div>
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-zinc-400">{model.description}</div>
                        </div>
                        {selectedModel === model.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
