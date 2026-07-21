"use client";

import { Check, Copy } from "lucide-react";
import type { ExplorerCodeBlock } from "@/lib/studioforge-types";

type CodeBlockProps = {
  block: ExplorerCodeBlock;
  copied: boolean;
  onCopy: (id: string, content: string) => void;
};

export function CodeBlock({ block, copied, onCopy }: CodeBlockProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0a0b14] shadow-inner-line">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-100">{block.title}</h4>
          <p className="text-xs text-slate-500">{block.language}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopy(block.id, block.content)}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:border-forge-violet/50 hover:bg-forge-purple/15 focus:outline-none focus:ring-2 focus:ring-forge-purple/60"
          aria-label={`Copy ${block.title}`}
        >
          {copied ? <Check className="h-4 w-4 text-forge-green" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="code-scroll max-h-[420px] overflow-auto p-4 text-sm leading-6 text-slate-200">
        <code>{block.content}</code>
      </pre>
    </section>
  );
}
