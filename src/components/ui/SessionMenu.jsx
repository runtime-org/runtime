import { HiDotsHorizontal } from "react-icons/hi";

export default function SessionMenu({ onMenuToggle }) {
    return (
        <div
            onClick={onMenuToggle}
            className="p-2 rounded hover:bg-[#323232] transition-colors"
        >
            <HiDotsHorizontal className="w-5 h-5 text-[#9E9E9E]" />
        </div>
    );
} 