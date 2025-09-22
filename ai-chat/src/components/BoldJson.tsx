"use client";
import * as React from 'react';

export type JSONLike = string | number | boolean | null | JSONLike[] | { [k: string]: JSONLike };

function Indent({ level }: { level: number }) {
  return <span>{'  '.repeat(level)}</span>;
}

function renderValue(value: JSONLike, level: number): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>[]</span>;
    return (
      <>
        <span>[</span>
        <br />
        {value.map((v, i) => (
          <div key={i}>
            <Indent level={level + 1} />
            {renderValue(v, level + 1)}
            {i < value.length - 1 ? <span>,</span> : null}
          </div>
        ))}
        <div>
          <Indent level={level} />
          <span>]</span>
        </div>
      </>
    );
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span>{'{}'}</span>;
    return (
      <>
        <span>{'{'}</span>
        <br />
        {entries.map(([k, v], i) => (
          <div key={k}>
            <Indent level={level + 1} />
            <strong>&quot;{k}&quot;</strong>
            <span>: </span>
            {renderValue(v as JSONLike, level + 1)}
            {i < entries.length - 1 ? <span>,</span> : null}
          </div>
        ))}
        <div>
          <Indent level={level} />
          <span>{'}'}</span>
        </div>
      </>
    );
  }
  // primitive
  if (typeof value === 'string') return <span>&quot;{value}&quot;</span>;
  if (value === null) return <span>null</span>;
  return <span>{String(value)}</span>;
}

export function BoldJson({ value }: { value: JSONLike }) {
  return (
    <div className="font-mono text-xs md:text-sm whitespace-pre leading-relaxed">
      {renderValue(value, 0)}
    </div>
  );
}


