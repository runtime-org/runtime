import React from "react";
import PropTypes from "prop-types";
import IconButton from "../ui/IconButton";

HeaderBar.propTypes = {
    title: PropTypes.string.isRequired,
    leftAction: PropTypes.object,
    rightAction: PropTypes.object,
}

export default function HeaderBar({ title, leftAction, rightAction }) {
    return (
        <header className="h-12 min-h-12 max-h-12 flex items-center justify-between px-2 border-b
                       border-[#484848]/70 backdrop-blur
            ">
            {
                leftAction ? <IconButton icon={leftAction.icon} onClick={leftAction.onClick} /> : <div className="w-5"></div>
            }
            <h1 className="text-lg font-medium text-white truncate">{title}</h1>
            {
                rightAction ? 
                rightAction.component ? 
                <div onClick={rightAction.onClick} className="cursor-pointer">
                    <rightAction.component {...rightAction.props} />
                </div> :
                <IconButton 
                    icon={rightAction.icon} 
                    onClick={rightAction.onClick} 
                    onMenuToggle={rightAction.onMenuToggle}
                /> 
                : 
                <div className="w-5"></div>
            }
        </header>
    )
}