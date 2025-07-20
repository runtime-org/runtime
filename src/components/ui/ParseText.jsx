import React from 'react';
import PropTypes from 'prop-types';

ParseText.propTypes = { text: PropTypes.string };

function renderInline(str, lineKey) {
  /*
  ** split on the **...** tokens, keep them in result
  */
  const parts = str.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${lineKey}-b-${i}`}>
          {part.slice(2, -2)} {/* strip the ** ** */}
        </strong>
      );
    }
    return part;
  });
}

export default function ParseText({ text }) {
  if (!text) return null;

  const lines   = text.split('\n').filter(l => l.trim() !== '');
  const out     = [];
  let listBuf   = [];

  /*
  ** helper to flush buffered list items into <ul>
  */
  const flushList = (key) => {
    if (!listBuf.length) return;

    out.push(
      <ul key={key} className="list-disc ml-6 mb-2">
        {listBuf.map(({ id, indent, node }) => (
          <li
            key={`li-${id}`}
            className="mb-1"
            style={{ marginLeft: indent * 16 }} 
          >
            {node}
          </li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  lines.forEach((raw, idx) => {
    /* 
    ** keep leading spaces for indent detection 
    */
    const bulletMatch = /^(\s*)\*\s+(.*)/.exec(raw);
    if (bulletMatch) {
      const leadingSpaces = bulletMatch[1].length;
      const indentLevel   = Math.floor(leadingSpaces / 2);      // 0,1,2…

      listBuf.push({
        id: idx,
        indent: indentLevel,
        node: renderInline(bulletMatch[2], idx),
      });
      return; // keep buffering bullets
    }

    /*
    ** flush list before any non-bullet line
    */
    flushList(`ul-${idx}`);

    /*
    ** headings (#…######)
    */
    const hMatch = /^(#{1,6})\s+(.*)/.exec(raw.trimStart());
    if (hMatch) {
      const level   = hMatch[1].length;
      const content = hMatch[2];
      const Tag     = `h${level}`;

      const size = ['text-2xl','text-xl','text-lg','text-base','text-sm','text-xs'][level-1];
      out.push(
        <Tag key={`h-${idx}`} className={`${size} font-semibold mb-1`}>
          {renderInline(content, idx)}
        </Tag>
      );
      return;
    }

    /*
    ** paragraph (default)
    */
    out.push(
      <p key={`p-${idx}`} className="mb-2 leading-snug">
        {renderInline(raw.trimStart(), idx)}
      </p>
    );
  });

  /*
  ** tail-end flush
  */
  flushList('ul-final');

  return <div className="text-[#a4a4a8]">{out}</div>;
}
