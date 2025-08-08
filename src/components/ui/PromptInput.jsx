import { useState, useRef, useEffect } from "react";
import { HiArrowUp, HiStop } from "react-icons/hi2";
import { useAppState } from "../../hooks/useAppState";
import { tabRegistry } from "../../lib/tab.registry";
import posthog from "../../lib/posthogSetup";

const AT_PATTERN = /(^|\s)@([^\s]*)$/; // start-or-space + @ + any non-space, captures the word

const version = "0.1.0";

export default function PromptInput({ 
    placeholder, 
    onSubmit,
    onStop,
    isProcessing
}) {
    const [text, setText] = useState("");
    const [candidates, setCandidates] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(0);

    const { 
        setCurrentQuery, 
        runtimeMode, 
        setRuntimeMode,
        selectedTabs,
        addSelectedTab,
        removeSelectedTab,
        clearSelectedTabs
    } = useAppState();
    const wrapperRef = useRef(null);
    const textareaRef = useRef(null);
    const pickerRef = useRef(null);
    const [pickerPos, setPickerPos] = useState({ left: 8, top: 0 });

    const openPicker = async (prefix) => {
        await tabRegistry.refresh();
        const list = tabRegistry.findByPrefix(prefix);
        setCandidates(list);
        setHighlightIdx(0);
        setShowPicker(true);
    };

    const closePicker = () => setShowPicker(false);

    function updatePickerPosition(anchorIndex) {
      const ta = textareaRef.current;
      const wrapper = wrapperRef.current;
      if (!ta || !wrapper) return;

      const { left, top } = getTextareaCaretPos(ta, anchorIndex);
      const wRect = wrapper.getBoundingClientRect();

      /*
      ** convert viewport coords → wrapper-relative
      */
      let x = left - wRect.left;
      let y = top - wRect.top;

      /*
      ** clamp horizontally so 14rem panel (224px) stays in view
      */
      const PANEL_W = 224;
      const PAD = 8;
      x = Math.max(PAD, Math.min(x, wRect.width - PANEL_W - PAD));

      setPickerPos({ left: x, top: y });
    }

    /*
    ** basic mirror measurement for textarea caret (viewport coords)
    */
    function getTextareaCaretPos(textarea, pos) {
      const cs = window.getComputedStyle(textarea);
      const div = document.createElement("div");
      const span = document.createElement("span");

      /*
      ** mirror styles that affect layout
      */
      const props = [
        "boxSizing","width","height","overflow","borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
        "paddingTop","paddingRight","paddingBottom","paddingLeft","fontSize","fontFamily","fontWeight","fontStyle",
        "letterSpacing","textTransform","textIndent","whiteSpace","wordWrap","lineHeight"
      ];
      props.forEach(p => { div.style[p] = cs[p]; });

      div.style.position = "absolute";
      div.style.visibility = "hidden";
      div.style.whiteSpace = "pre-wrap";
      div.style.wordWrap = "break-word";
      div.style.overflow = "hidden";

      const value = textarea.value;
      const before = value.substring(0, pos);
      const after = value.substring(pos);

      /*
      ** ensure trailing newline is measurable
      */
      div.textContent = before.replace(/\n$/, "\n ");
      span.textContent = after.length ? after[0] : ".";
      div.appendChild(span);

      document.body.appendChild(div);
      const dRect = div.getBoundingClientRect();
      const sRect = span.getBoundingClientRect();
      const result = { left: sRect.left, top: sRect.top + sRect.height }; // baseline → caret bottom
      document.body.removeChild(div);

      /*
      ** adjust for textarea scroll offset and position
      */
      const taRect = textarea.getBoundingClientRect();
      return {
        left: result.left - dRect.left + taRect.left - textarea.scrollLeft,
        top: result.top - dRect.top + taRect.top - textarea.scrollTop
      };
    }

    /*
    ** handle input change
    */
    const handleChange = (e) => {
        const v = e.target.value;
        setText(v);
      
        // @prefix
        const caret = e.target.selectionStart ?? v.length;
        const before = v.slice(0, caret);
        const m = before.match(AT_PATTERN);
        if (m) {
          openPicker(m[2] ?? "");
          updatePickerPosition(caret - (m[2]?.length ?? 0) - 1 /* "@" index */);
        } else {
          closePicker();
        }
    };

    /*
    ** handle commit pick
    */
    const commitPick = (tab) => {
        addSelectedTab({ title: tab.title, url: tab.url, page: tab.page });
        setShowPicker(false);
      
        /*
        ** replace only the token before the caret
        */
        const ta = textareaRef.current;
        const v = text;
        const caret = ta?.selectionStart ?? v.length;
        const before = v.slice(0, caret);
        const after = v.slice(caret);
        
        const cleanedBefore = before.replace(AT_PATTERN, '$1');
        const newText = cleanedBefore + after;
        setText(newText);
        
        /*
        ** restore caret position
        */
        requestAnimationFrame(() => {
          try {
            const pos = cleanedBefore.length;
            ta?.setSelectionRange(pos, pos);
            ta?.focus();
          } catch {}
        });
    };

    /*
    ** handle send
    */
    const handleSend = () => {
        if (!text.trim()) return;

        setCurrentQuery(text);
        
        const pages = selectedTabs?.map(t => t.page).filter(Boolean) || [];
        onSubmit({ text: text.trim(), pages: pages.length ? pages : undefined });
        
        setText("");
        clearSelectedTabs();
    };

    /*
    ** handle stop
    */
    const handleStop = () => {
        onStop();
    }

    /*
    ** handle key down
    */
    const handleKeyDown = (e) => {
        if (!showPicker) {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            return;
        }

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIdx((idx) =>
                e.key === "ArrowDown"
                    ? (idx + 1) % candidates.length
                    : (idx - 1 + candidates.length) % candidates.length
            );
        } else if (e.key === "Enter") {
            e.preventDefault();
            commitPick(candidates[highlightIdx]);
        } else if (e.key === "Escape") {
            closePicker();
        }
    };

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.focus(); // auto focus
            textarea.style.height = 'auto';
            const newHeight = Math.min(textarea.scrollHeight, 100);
            textarea.style.height = `${newHeight}px`;
        }
    }, [text]);

    /*
    ** reposition while picker is open (resize/scroll/typing)
    */
    useEffect(() => {
      if (!showPicker) return;
      const ta = textareaRef.current;
      const handler = () => {
        const caret = ta?.selectionStart ?? (text?.length ?? 0);
        updatePickerPosition(caret);
      };
      window.addEventListener("resize", handler);
      ta?.addEventListener("scroll", handler);
      return () => {
        window.removeEventListener("resize", handler);
        ta?.removeEventListener("scroll", handler);
      };
    }, [showPicker, text]);

    /*
    ** handle document mouse down
    */
    useEffect(() => {
        if (!showPicker) return;
        const handleDocMouseDown = (e) => {
          const picker = pickerRef.current;
          const ta = textareaRef.current;
          if (picker && picker.contains(e.target)) return;
          if (ta && ta.contains(e.target)) return;
          setShowPicker(false);
        };
        document.addEventListener("mousedown", handleDocMouseDown);
        return () => document.removeEventListener("mousedown", handleDocMouseDown);
    }, [showPicker]);

    return (
        <div ref={wrapperRef} className="p-2.5 pt-0 flex flex-col relative">
            <div className="flex items-center w-full rounded-[12px] bg-[#323232] gap-1 p-1 border border-[#484848]/70">
                <div className="flex flex-col w-full gap-1 ">

                    {selectedTabs?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {selectedTabs.map((t, index) => (
                                <span key={`${t.title}-${t.url}-${index}`}
                                    className="inline-flex items-center max-w-56 border border-[#404144] text-white/70 px-1.5 py-0.5 rounded-md text-xs hover:cursor-pointer">
                                    <span className="truncate">{t.title || t.url || "Tab"}</span>
                                    <button
                                        className="ml-0.5 text-xs text-white/70 hover:text-white hover:cursor-pointer"
                                        onMouseDown={(e) => { 
                                            e.preventDefault(); 
                                            removeSelectedTab(t.title, t.url);
                                        }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className="w-3 h-3">
                                            <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>
                                        </svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        className="flex-grow resize-none bg-transparent rounded p-2 text-base no-scrollbar 
                                focus:outline-none min-h-[40px] max-h-[100px] w-full"
                        rows={1}
                        placeholder={placeholder}
                        value={text}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />

                    <div className="flex items-center justify-between self-stretch">
                        <div className="flex items-center gap-1"> 
                            <div 
                                onClick={() => {
                                    setRuntimeMode("research");
                                    posthog.capture("research_mode_active", { version });
                                }}
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
                                onClick={() => {
                                    setRuntimeMode("action");
                                    posthog.capture("action_mode_active", { version });
                                }}
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

            {showPicker && (
                <div
                  className="absolute z-50 w-56"
                  style={{
                    left: pickerPos.left,
                    top: pickerPos.top,
                    transform: "translateY(-100%) translateY(-32px)" // place above caret with 32px gap
                  }}
                >
                  <div
                    ref={pickerRef}
                    className="bg-[#2b2b2b] border border-[#3a3a3a] rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.35)] overflow-hidden"
                  >
                    <div className="px-3 pt-3 pb-1 text-xs text-gray-400">Tabs</div>
                    <div className="max-h-64 overflow-y-auto">
                      {candidates.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-400">No tabs found</div>
                      ) : (
                        candidates.map((t, i) => (
                          <div
                            key={`${t.title}-${t.url}-${i}`}
                            onMouseDown={() => commitPick(t)}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer ${
                              i === highlightIdx ? "bg-[#344054]/40" : "hover:bg-[#3a3a3a]"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-white truncate">{t.title}</div>
                              <div className="text-xs text-gray-400 truncate">{t.url}</div>
                            </div>
                            <span
                              className={`ml-3 h-2 w-2 rounded-full ${i === highlightIdx ? "bg-[#3b82f6]" : "bg-transparent"}`}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
            )}
        </div>
    )
}