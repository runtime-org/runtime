import { useState, useRef, useEffect } from "react";
import { HiArrowUp, HiStop } from "react-icons/hi2";
import { useAppState } from "../../hooks/useAppState";

export default function PromptInput({ 
    placeholder, 
    onSubmit,
    onStop,
    isProcessing
}) {
    const [text, setText] = useState("");
    const { setCurrentQuery, runtimeMode, setRuntimeMode } = useAppState();
    const textareaRef = useRef(null);

    const handleSend = () => {
        if (!text.trim()) return;
        setCurrentQuery(text);
        onSubmit(text);
        setText("");
    }

    const handleStop = () => {
        onStop();
    }

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.focus(); // auto focus
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 100);
            textarea.style.height = `${newHeight}px`;
        }
    }, [text]);

    return (
        <div className="p-2.5 pt-0 flex flex-col">
            {/* <div className="text-xs text-gray-400 mb-1 ml-1">
                Control your browser
            </div> */}
            <div className="flex items-center w-full rounded-[12px] bg-[#323232] gap-1 p-1 border border-[#484848]/70">
                <div className="flex flex-col w-full gap-1 ">
                    <textarea
                        ref={textareaRef}
                        className="flex-grow resize-none bg-transparent rounded p-2 text-base no-scrollbar 
                                focus:outline-none min-h-[40px] max-h-[100px]"
                        rows={1}
                        placeholder={placeholder}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => (e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), handleSend()) : null)}
                    />

                    <div className="flex items-center justify-between self-stretch">
                        <div className="flex items-center gap-1"> 
                            <div 
                                onClick={() => setRuntimeMode("research")}
                                className={`flex items-center gap-1.5 cursor-pointer rounded-lg py-1 px-1.5 border transition-colors ${
                                    runtimeMode === "research" 
                                        ? 'border-blue-500 bg-blue-500/20' 
                                        : 'border-[#404144] hover:bg-[#404144]'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill={runtimeMode === "research" ? "#60a5fa" : "#969696"} viewBox="0 0 256 256" className="w-3 h-3">
                                    <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>
                                </svg>
                                <span className={`text-xs mr-1 ${runtimeMode === "research" ? 'text-blue-400' : 'text-white/70'}`}>research</span>
                            </div>
                            <div 
                                onClick={() => setRuntimeMode("action")}
                                className={`flex items-center gap-1.5 cursor-pointer rounded-lg py-1 px-1.5 border transition-colors ${
                                    runtimeMode === "action" 
                                        ? 'border-blue-500 bg-blue-500/20' 
                                        : 'border-[#404144] hover:bg-[#404144]'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill={runtimeMode === "action" ? "#60a5fa" : "#969696"} viewBox="0 0 256 256" className="w-3 h-3">
                                    <path d="M237.33,106.21,61.41,41l-.16-.05A16,16,0,0,0,40.9,61.25a1,1,0,0,0,.05.16l65.26,175.92A15.77,15.77,0,0,0,121.28,248h.3a15.77,15.77,0,0,0,15-11.29l.06-.2,21.84-78,78-21.84.2-.06a16,16,0,0,0,.62-30.38ZM149.84,144.3a8,8,0,0,0-5.54,5.54L121.3,232l-.06-.17L56,56l175.82,65.22.16.06Z"></path>
                                </svg>
                                <span className={`text-xs mr-1 ${runtimeMode === "action" ? 'text-blue-400' : 'text-white/70'}`}>action</span>
                            </div>
                        </div>
                        <div 
                            onClick={isProcessing ? handleStop : handleSend}
                            className={`h-6 w-6 -mb-[2px] -mr-[1px] rounded-full flex items-center justify-center duration-200 transition-colors ${
                                isProcessing
                                    ? 'bg-white cursor-pointer'
                                    : (text.trim() ? 'bg-white cursor-pointer' : 'bg-gray-400/20')
                            }`}
                        >
                            {isProcessing ? (
                                <HiStop 
                                    strokeWidth={2}
                                    className={`w-3 h-3 duration-300 transition-colors text-gray-400 ${text.trim() ? 'text-zinc-800' : 'text-zinc-800'}`} 
                                />
                            ) : (
                                <HiArrowUp 
                                    strokeWidth={2}
                                    className={`w-3 h-3 duration-300 transition-colors ${text.trim() ? 'text-zinc-800' : 'text-gray-400'}`} 
                                />
                            )}
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    )
}