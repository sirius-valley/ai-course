"use client";
import * as React from 'react';

type JsonPrimitive = string | number | boolean | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function previewValue(value: JsonPrimitive): string {
  if (typeof value === 'string') {
    const str = JSON.stringify(value);
    return str.length > 80 ? str.slice(0, 77) + '…"' : str;
  }
  if (value === null) return 'null';
  return String(value);
}

export function JsonViewer({ value, name, defaultOpen = false }: { value: unknown; name?: string; defaultOpen?: boolean }) {
  if (Array.isArray(value)) {
    return (
      <details className="pl-3 border-l border-border" open={defaultOpen}>
        <summary className="cursor-pointer select-none text-xs py-1">{name ? <strong className="mr-1">{name}:</strong> : null}[{value.length}]</summary>
        <div className="space-y-1">
          {value.map((item, idx) => (
            <JsonViewer key={idx} name={String(idx)} value={item} />
          ))}
        </div>
      </details>
    );
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    return (
      <details className="pl-3 border-l border-border" open={defaultOpen}>
        <summary className="cursor-pointer select-none text-xs py-1">{name ? <strong className="mr-1">{name}:</strong> : null}{'{'}{entries.length} fields{'}'}</summary>
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <JsonViewer key={k} name={k} value={v} />
          ))}
        </div>
      </details>
    );
  }
  // primitive
  return (
    <div className="text-xs py-0.5">
      {name ? <strong className="mr-1">{name}:</strong> : null}
      <code className="font-mono">{previewValue(value as JsonPrimitive)}</code>
    </div>
  );
}


