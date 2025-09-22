import * as React from 'react';
import { twMerge } from 'tailwind-merge';

export const Badge = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <span className={twMerge('inline-flex items-center rounded border px-2 py-0.5 text-xs', className)}>
    {children}
  </span>
);


