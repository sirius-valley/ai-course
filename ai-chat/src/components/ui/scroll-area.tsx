"use client";
import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { twMerge } from 'tailwind-merge';

export const ScrollArea = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <ScrollAreaPrimitive.Root className={twMerge('relative overflow-hidden', className)}>
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scrollbar-none">
      {children}
    </ScrollAreaPrimitive.Viewport>
    {/* Hide Radix scrollbar visuals */}
  </ScrollAreaPrimitive.Root>
);


