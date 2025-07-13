import { useState, useRef, useEffect } from "react";

{/* state: "running" | "success" | "error" */}
export default function PlanIcon({ state, setState, active }) {
    const [barWidths, setBarWidths] = useState([10, 10, 10]);
    const animationRef = useRef(null);
    const timeRef = useRef(0);
    
    useEffect(() => {
        if (state === "running") {
            const animate = () => {
                timeRef.current += 0.1;
                
                setBarWidths(prevWidths => {
                    // animate the bars
                    const t = timeRef.current;
                    return [
                        10 + 4 * Math.sin(t),
                        10 + 4 * Math.sin(t - 0.7),
                        10 + 4 * Math.sin(t - 1.4)
                    ];
                });
                
                animationRef.current = requestAnimationFrame(animate);
            };
            
            animationRef.current = requestAnimationFrame(animate);
            
            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
            };
        }
    }, [state]);

    return (
        <div className={`flex items-center rounded h-[16px] w-[16px] ${active ? "bg-white" : "bg-[#a4a4a8]"}`}>
            <div className="flex flex-col justify-center items-center h-full w-full gap-[2px]">
                <div className={`h-[2px] rounded-full transition-all duration-100 ${active ? "bg-[#110f15]" : "bg-[#151319]"}`} style={{ width: `${barWidths[0]}px` }}></div>
                <div className={`h-[2px] rounded-full transition-all duration-100 ${active ? "bg-[#110f15]" : "bg-[#151319]"}`} style={{ width: `${barWidths[1]}px` }}></div>
                <div className={`h-[2px] rounded-full transition-all duration-100 ${active ? "bg-[#110f15]" : "bg-[#151319]"}`} style={{ width: `${barWidths[2]}px` }}></div>
            </div>
        </div>
    )
}