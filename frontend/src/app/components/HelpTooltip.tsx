"use client";

import React, { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

export default function HelpTooltip({
  content,
  side = "top",
  align = "center",
  className = "",
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`inline-flex items-center justify-center text-zinc-400 hover:text-cyan-400 focus:text-cyan-400 transition-colors cursor-pointer outline-none rounded-full p-0.5 group ${className}`}
        aria-label="Aide"
      >
        <HelpCircle className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={6}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="z-[200] max-w-xs p-3 bg-[#09090b] text-zinc-200 border border-zinc-800 rounded-xl shadow-2xl text-xs font-normal leading-relaxed outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150"
        >
          {content}
          <Popover.Arrow className="fill-[#09090b] stroke-zinc-800 stroke-1" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
