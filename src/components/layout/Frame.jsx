import React from "react";
import PropTypes from "prop-types";

Frame.propTypes = {
    children: PropTypes.node.isRequired,
}

export default function Frame({ children }) {
    return (
        <div className="w-[400px] h-screen bg-[#242424] text-white
            flex flex-col border-l border-zinc-800
            ">
            {children}
        </div>
    )
}