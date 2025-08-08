import React from 'react';

export default function Mention({ text }) {
    if (!text || !text.includes('$$')) return null;
    
    // match all $$mentions$$ in the text
    const mentionPattern = /\$\$([^$]+)\$\$/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    const textCopy = text.toString();
    
    while ((match = mentionPattern.exec(textCopy)) !== null) {
        // add text before the mention
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: textCopy.slice(lastIndex, match.index)
            });
        }
        
        // add the mention with styling
        parts.push({
            type: 'mention',
            content: match[0] // include the @ symbol
        });
        
        lastIndex = match.index + match[0].length;
    }
    
    // add remaining text
    if (lastIndex < textCopy.length) {
        parts.push({
            type: 'text',
            content: textCopy.slice(lastIndex)
        });
    }
    
    return (
        <div className="absolute inset-0 pointer-events-none p-2 text-base whitespace-pre-wrap break-words overflow-hidden leading-normal">
            {parts.map((part, index) => (
                <span key={index}>
                    {part.type === 'mention' ? (
                        <span className="bg-blue-500/20 text-blue-300 px-1 rounded">
                            @{part.content}
                        </span>
                    ) : (
                        <span style={{ color: 'transparent' }}>{part.content}</span>
                    )}
                </span>
            ))}
        </div>
    );
}
