import React from "react";
import { HiArrowLeft, HiXMark, HiTrash } from "react-icons/hi2";
import { HiMenu, HiDotsHorizontal } from "react-icons/hi";

const iconMap = {
    "back": HiArrowLeft,
    "history": HiMenu,
    "close": HiXMark,
    "trash": HiTrash,
    "3dots": HiDotsHorizontal,
}

export default function IconButton({ icon, label, onClick }) {
    const Icon = iconMap[icon] || HiXMark;

    return (
        <div
            aria-label={label ?? icon}
            onClick={onClick}
            className={`group hover:cursor-pointer rounded duration-200 transition p-2 hover:bg-[#2B2B2E]`}
        > 
            <Icon className="w-5 h-5 text-gray-400 group-hover:text-white" />
        </div>
    );
}