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
    const { setCurrentQuery } = useAppState();
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

                <div className="flex items-end self-stretch pb-[5px]">
                    <div 
                        onClick={isProcessing ? handleStop : handleSend}
                        className={`h-8 w-8 mr-1 rounded-full flex items-center justify-center duration-200 transition-colors ${
                            text.trim() ? 'bg-white cursor-pointer' : 'bg-gray-400/20'
                        }`}
                    >
                        {isProcessing ? (
                            <HiStop 
                                strokeWidth={2}
                                className={`w-4 h-4 duration-300 transition-colors text-gray-400`} 
                            />
                        ) : (
                            <HiArrowUp 
                                strokeWidth={2}
                                className={`w-4 h-4 duration-300 transition-colors ${text.trim() ? 'text-zinc-800' : 'text-gray-400'}`} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}