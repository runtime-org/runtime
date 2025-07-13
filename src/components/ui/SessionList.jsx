import React from "react";
import SessionItem from "./SessionItem";

export default function SessionList({ sessions, emptyLabel }) {
    return (
        <div className="flex flex-col gap-2 p-1.5 h-full w-full overflow-y-auto no-scrollbar">
            {
                sessions.length > 0 && sessions[0]?.id ? 
                    sessions.map(session => 
                        <SessionItem key={session.id} session={session} />
                    )
                : 
                <p className="text-center text-[#9E9E9E]">{emptyLabel}</p>}
        </div>
    )
}