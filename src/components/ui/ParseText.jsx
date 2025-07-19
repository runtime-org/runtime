import React from 'react';
import PropTypes from 'prop-types';

ParseText.propTypes = {
    text: PropTypes.string,
};

function renderInline(str, lineKey) {
  // split on the **...** tokens, keep them in result
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

  const lines = text.split('\n').filter(l => l.trim() !== '');
  const out = [];
  let listBuf = [];

  const flushList = (key) => {
    if (!listBuf.length) return;
    out.push(
      <ul key={key} className="list-disc ml-6 mb-2">
        {listBuf}
      </ul>
    );
    listBuf = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();

    /*
    ** bullet item
    */
    if (/^\* /.test(line)) {
      const itemTxt = line.slice(2);
      listBuf.push(
        <li key={`li-${idx}`} className="mb-1">
          {renderInline(itemTxt, idx)}
        </li>
      );
      return;  // keep buffering
    }

    /*
    * flush any open list before non-bullet line
    */
    flushList(`ul-${idx}`);

    /*
    * heading (#, ## … ######)
    */
    const hMatch = /^(#{1,6})\s+(.*)/.exec(line);
    if (hMatch) {
      const level = hMatch[1].length;    // 1–6
      const content = hMatch[2];
      const Tag = `h${level}`;

      const sizeMap = ['text-2xl','text-xl','text-lg','text-base','text-sm','text-xs'];
      out.push(
        <Tag
          key={`h-${idx}`}
          className={`${sizeMap[level-1]} font-semibold mb-1`}
        >
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
        {renderInline(line, idx)}
      </p>
    );
  });

  /*
  ** flush any trailing list
  */
  flushList('ul-final');

  return <div className="text-[#a4a4a8]">{out}</div>;
}
