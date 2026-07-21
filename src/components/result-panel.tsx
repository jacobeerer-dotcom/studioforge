"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Copy,
  FileCode2,
  Folder,
  FolderOpen,
  Info,
  Layers3,
  ListChecks,
  Network,
  Server,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CodeBlock } from "@/components/code-block";
import type { ExplorerCodeBlock, ResultPayload } from "@/lib/studioforge-types";

type ResultPanelProps = {
  result: ResultPayload | null;
  loading: boolean;
  placeholderTitle: string;
  placeholderText: string;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
};

type ExplorerNode = {
  id: string;
  label: string;
  depth: number;
  children: ExplorerNode[];
};

type ScriptCard = {
  id: string;
  filename: string;
  code: string;
};

const loadingSteps = [
  "Understanding Prompt",
  "Planning Architecture",
  "Generating Explorer",
  "Generating Scripts",
  "Preparing Notes",
  "Finalizing",
];

const luauKeywords = new Set([
  "and",
  "break",
  "continue",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
]);

export function ResultPanel({
  result,
  loading,
  placeholderTitle,
  placeholderText,
  copiedId,
  onCopy,
}: ResultPanelProps) {
  if (loading) {
    return <LoadingPanel />;
  }

  if (!result) {
    return (
      <aside className="glass-panel flex min-h-[520px] items-center justify-center rounded-xl p-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl border border-white/10 bg-white/[0.045]">
            <Clipboard className="h-6 w-6 text-forge-cyan" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-slate-100">{placeholderTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{placeholderText}</p>
        </div>
      </aside>
    );
  }

  const isBuildResult = result.eyebrow.toLowerCase().includes("build");
  const isVisionResult = result.eyebrow.toLowerCase().includes("vision");
  const copyAllId = `${result.eyebrow}-copy-all`;

  return (
    <aside className="glass-panel min-h-[520px] rounded-xl p-5 animate-fade-up">
      <ResultHeader
        result={result}
        copied={copiedId === copyAllId}
        onCopyAll={() => onCopy(copyAllId, resultToMarkdown(result))}
      />

      {isBuildResult ? (
        <BuildResult result={result} copiedId={copiedId} onCopy={onCopy} />
      ) : isVisionResult ? (
        <VisionResult result={result} copiedId={copiedId} onCopy={onCopy} />
      ) : (
        <GenericResult result={result} copiedId={copiedId} onCopy={onCopy} />
      )}
    </aside>
  );
}

function ResultHeader({
  result,
  copied,
  onCopyAll,
}: {
  result: ResultPayload;
  copied: boolean;
  onCopyAll: () => void;
}) {
  return (
    <div className="rounded-lg border border-forge-purple/20 bg-forge-purple/10 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-forge-purple/20 text-forge-violet">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forge-violet">{result.eyebrow}</p>
              <h3 className="mt-1 max-w-2xl text-xl font-semibold leading-7 text-slate-50">{result.title}</h3>
            </div>
            <button
              type="button"
              onClick={onCopyAll}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-slate-200 transition hover:border-forge-violet/45 hover:bg-forge-purple/15 focus:outline-none focus:ring-2 focus:ring-forge-purple/50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-forge-green" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy All"}
            </button>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{result.summary}</p>
        </div>
      </div>
    </div>
  );
}

function BuildResult({
  result,
  copiedId,
  onCopy,
}: {
  result: ResultPayload;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}) {
  const hierarchyBlock = result.blocks.find((block) => block.language === "Explorer");
  const scriptCards = result.blocks.filter((block) => block.language === "Luau").flatMap((block) => extractScriptCards(block));
  const noteBlocks = result.blocks.filter((block) => block.language === "Instructions");

  return (
    <>
      {hierarchyBlock ? (
        <SectionShell icon={FolderOpen} title="Explorer Structure" badge="Roblox Explorer">
          <ExplorerTree content={hierarchyBlock.content} />
        </SectionShell>
      ) : null}

      {scriptCards.length > 0 ? (
        <SectionShell icon={FileCode2} title="Generated Scripts" badge={`${scriptCards.length}`}>
          <div className="space-y-3">
            {scriptCards.map((script) => (
              <LuauScriptCard key={script.id} script={script} copied={copiedId === script.id} onCopy={onCopy} />
            ))}
          </div>
        </SectionShell>
      ) : null}

      {noteBlocks.length > 0 ? (
        <SectionShell icon={Info} title="Implementation Notes" badge="Setup">
          <div className="grid gap-3">
            {noteBlocks.flatMap((block) => infoItemsFromBlock(block)).map((item) => (
              <InfoCard key={item.id} title={item.title} content={item.content} />
            ))}
          </div>
        </SectionShell>
      ) : null}
    </>
  );
}

function VisionResult({
  result,
  copiedId,
  onCopy,
}: {
  result: ResultPayload;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}) {
  const hierarchyBlock = result.blocks.find((block) => block.language === "Explorer");
  const codeBlocks = result.blocks.filter((block) => block.language === "Luau");
  const noteBlocks = result.blocks.filter((block) => block.language === "Instructions");

  return (
    <>
      {result.bullets ? (
        <SectionShell icon={Layers3} title="Detected Components" badge={`${result.bullets.length}`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.bullets.map((bullet, index) => (
              <div key={`${bullet}-${index}`} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm leading-5 text-slate-300">
                <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-forge-cyan/10 px-1.5 text-[11px] font-bold text-forge-cyan">
                  {index + 1}
                </span>
                {bullet}
              </div>
            ))}
          </div>
        </SectionShell>
      ) : null}

      {hierarchyBlock ? (
        <SectionShell icon={FolderOpen} title="Hierarchy" badge="Roblox Explorer">
          <ExplorerTree content={hierarchyBlock.content} />
        </SectionShell>
      ) : null}

      <SectionShell icon={Sparkles} title="Visual Style" badge="UI Vision">
        <InfoCard title="Style interpretation" content={result.summary} />
      </SectionShell>

      {noteBlocks.length > 0 ? (
        <SectionShell icon={Info} title="Implementation Tips" badge="Notes">
          <div className="grid gap-3">
            {noteBlocks.flatMap((block) => infoItemsFromBlock(block)).map((item) => (
              <InfoCard key={item.id} title={item.title} content={item.content} />
            ))}
          </div>
        </SectionShell>
      ) : null}

      {codeBlocks.length > 0 ? (
        <SectionShell icon={FileCode2} title="Generated Luau" badge={`${codeBlocks.length}`}>
          <div className="space-y-3">
            {codeBlocks.flatMap((block) => extractScriptCards(block)).map((script) => (
              <LuauScriptCard key={script.id} script={script} copied={copiedId === script.id} onCopy={onCopy} />
            ))}
          </div>
        </SectionShell>
      ) : null}
    </>
  );
}

function GenericResult({
  result,
  copiedId,
  onCopy,
}: {
  result: ResultPayload;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
}) {
  return (
    <>
      {result.bullets ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {result.bullets.map((bullet) => (
            <div key={bullet} className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm leading-5 text-slate-300">
              {bullet}
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        {result.blocks.map((block) => (
          <CodeBlock key={block.id} block={block} copied={copiedId === block.id} onCopy={onCopy} />
        ))}
      </div>
    </>
  );
}

function LoadingPanel() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
    const intervalId = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, loadingSteps.length - 1));
    }, 950);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <aside className="glass-panel min-h-[520px] rounded-xl p-5">
      <div className="rounded-lg border border-forge-purple/20 bg-forge-purple/10 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-forge-purple/30 bg-forge-purple/15">
            <Sparkles className="h-4 w-4 animate-pulse text-forge-violet" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">Forging Roblox output</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">StudioForge is preparing hierarchy, scripts, and implementation notes.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-[#0a0b14] p-4">
        <div className="space-y-3">
          {loadingSteps.map((step, index) => {
            const complete = index < stepIndex;
            const active = index === stepIndex;

            return (
              <div key={step} className="flex items-center gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${
                    complete
                      ? "border-forge-green/40 bg-forge-green/15 text-forge-green"
                      : active
                        ? "border-forge-purple/50 bg-forge-purple/20 text-forge-violet"
                        : "border-white/10 bg-white/[0.035] text-slate-600"
                  }`}
                >
                  {complete ? <Check className="h-3.5 w-3.5" /> : <span className={active ? "h-2 w-2 rounded-full bg-current animate-pulse" : "h-2 w-2 rounded-full bg-current"} />}
                </span>
                <span className={`text-sm font-medium ${complete || active ? "text-slate-100" : "text-slate-500"}`}>{step}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="h-12 animate-pulse-line rounded-lg bg-white/[0.045]" />
        <div className="h-44 animate-pulse-line rounded-lg bg-white/[0.04]" />
        <div className="h-32 animate-pulse-line rounded-lg bg-white/[0.035]" />
      </div>
    </aside>
  );
}

function SectionShell({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/[0.055] text-forge-violet">
            <Icon className="h-4 w-4" />
          </span>
          <h4 className="truncate text-sm font-semibold text-slate-100">{title}</h4>
        </div>
        <span className="shrink-0 rounded-md border border-white/10 bg-[#0a0b14] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {badge}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ExplorerTree({ content }: { content: string }) {
  const nodes = useMemo(() => parseExplorerTree(content), [content]);

  if (nodes.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-[#0a0b14] p-4 text-sm text-slate-500">No Explorer hierarchy returned.</div>;
  }

  return (
    <div className="code-scroll max-h-[430px] overflow-auto rounded-lg border border-white/10 bg-[#080912] p-2">
      {nodes.map((node) => (
        <ExplorerTreeNode key={node.id} node={node} />
      ))}
    </div>
  );
}

function ExplorerTreeNode({ node }: { node: ExplorerNode }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const Icon = getExplorerIcon(node);

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded((current) => !current)}
        className="group flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-slate-300 transition hover:bg-white/[0.055]"
        style={{ paddingLeft: `${8 + node.depth * 18}px` }}
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center text-slate-500">
          {hasChildren ? expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" /> : null}
        </span>
        <Icon className={`h-4 w-4 shrink-0 ${isScriptNode(node.label) ? "text-forge-green" : isRemoteNode(node.label) ? "text-forge-cyan" : "text-forge-violet"}`} />
        <span className="min-w-0 truncate font-medium">{node.label}</span>
      </button>
      {expanded && hasChildren ? node.children.map((child) => <ExplorerTreeNode key={child.id} node={child} />) : null}
    </div>
  );
}

function LuauScriptCard({
  script,
  copied,
  onCopy,
}: {
  script: ScriptCard;
  copied: boolean;
  onCopy: (id: string, content: string) => void;
}) {
  const lines = script.code.split("\n");

  return (
    <article className="overflow-hidden rounded-lg border border-white/10 bg-[#080912] shadow-inner-line transition hover:border-forge-green/25">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-forge-green/10 text-forge-green">
            <FileCode2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h5 className="truncate text-sm font-semibold text-slate-100">{script.filename}</h5>
            <p className="text-xs text-slate-500">Luau</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCopy(script.id, script.code)}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:border-forge-green/45 hover:bg-forge-green/10 focus:outline-none focus:ring-2 focus:ring-forge-green/40"
          aria-label={`Copy ${script.filename}`}
        >
          {copied ? <Check className="h-4 w-4 text-forge-green" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      <pre className="code-scroll max-h-[460px] overflow-auto p-4 text-sm leading-6">
        <code>
          {lines.map((line, index) => (
            <span key={`${index}-${line}`} className="block min-h-6">
              <span className="mr-4 inline-block w-8 select-none text-right text-xs text-slate-600">{index + 1}</span>
              {highlightLuauLine(line)}
            </span>
          ))}
        </code>
      </pre>
    </article>
  );
}

function InfoCard({ title, content }: { title: string; content: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#0a0b14] p-4 transition hover:border-forge-cyan/25 hover:bg-white/[0.035]">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-forge-cyan/10 text-forge-cyan">
          <ListChecks className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-slate-100">{title}</h5>
          <p className="mt-1 text-sm leading-6 text-slate-400">{content}</p>
        </div>
      </div>
    </article>
  );
}

function parseExplorerTree(content: string): ExplorerNode[] {
  const lines = stripCodeFence(content)
    .split("\n")
    .map((line) => parseExplorerLine(line))
    .filter((line): line is { depth: number; label: string } => Boolean(line && line.label));

  const roots: ExplorerNode[] = [];
  const stack: ExplorerNode[] = [];

  lines.forEach((line, index) => {
    const node: ExplorerNode = {
      id: `${index}-${line.label}`,
      label: line.label,
      depth: Math.max(0, line.depth),
      children: [],
    };
    const parent = node.depth > 0 ? stack[node.depth - 1] : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
      node.depth = 0;
    }

    stack[node.depth] = node;
    stack.length = node.depth + 1;
  });

  return roots;
}

function parseExplorerLine(line: string): { depth: number; label: string } | null {
  if (!line.trim()) {
    return null;
  }

  const treeMatch = line.match(/^([\s\u2502]*)(?:[\u251c\u2514]\s*[\u2500-]{1,3}\s*)?(.*)$/);
  const prefix = treeMatch?.[1] ?? "";
  const rawLabel = treeMatch?.[2] ?? line.trim();
  const hasTreeBranch = /[\u251c\u2514]/.test(line);
  const normalizedPrefix = prefix.replace(/\u2502/g, "    ").replace(/\t/g, "  ");
  const plainIndent = line.match(/^\s*/)?.[0].replace(/\t/g, "  ").length ?? 0;
  const depth = hasTreeBranch ? Math.floor(normalizedPrefix.length / 4) + 1 : Math.floor(plainIndent / 2);
  const label = rawLabel
    .replace(/^[\s\u2502\u251c\u2514\u2500-]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();

  if (!label || label.startsWith("```")) {
    return null;
  }

  return {
    depth,
    label,
  };
}

function getExplorerIcon(node: ExplorerNode): LucideIcon {
  if (isScriptNode(node.label)) {
    return FileCode2;
  }

  if (isRemoteNode(node.label)) {
    return Network;
  }

  if (node.label.toLowerCase().includes("server")) {
    return Server;
  }

  return node.children.length > 0 || isFolderishNode(node.label) ? Folder : FolderOpen;
}

function isScriptNode(label: string): boolean {
  return /script|localscript|modulescript|\.lua|\.luau/i.test(label);
}

function isRemoteNode(label: string): boolean {
  return /remoteevent|remotefunction|remote/i.test(label);
}

function isFolderishNode(label: string): boolean {
  return /folder|service|storage|gui|frame|screen|workspace|players|lighting|replicated/i.test(label);
}

function extractScriptCards(block: ExplorerCodeBlock): ScriptCard[] {
  const content = stripCodeFence(block.content).trim();

  if (!content) {
    return [];
  }

  const markerCards = splitByScriptMarkers(content, block.title);

  if (markerCards.length > 0) {
    return markerCards.map((card, index) => ({
      ...card,
      id: `${block.id}-script-${index}`,
    }));
  }

  return [
    {
      id: `${block.id}-script-0`,
      filename: filenameFromTitle(block.title),
      code: content,
    },
  ];
}

function splitByScriptMarkers(content: string, fallbackTitle: string): Omit<ScriptCard, "id">[] {
  const lines = content.split("\n");
  const cards: Omit<ScriptCard, "id">[] = [];
  let currentName = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const marker = line.match(/^\s*--\s*(?:Script|LocalScript|ModuleScript|ServerScript|ClientScript|File)\s*:\s*(.+)$/i);

    if (marker) {
      if (currentLines.join("\n").trim()) {
        cards.push({
          filename: sanitizeFilename(currentName || fallbackTitle),
          code: currentLines.join("\n").trim(),
        });
      }

      currentName = marker[1].trim();
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  if (currentName && currentLines.join("\n").trim()) {
    cards.push({
      filename: sanitizeFilename(currentName),
      code: currentLines.join("\n").trim(),
    });
  }

  return cards;
}

function infoItemsFromBlock(block: ExplorerCodeBlock): Array<{ id: string; title: string; content: string }> {
  const content = stripCodeFence(block.content).trim();
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const listItems = lines
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);

  if (listItems.length <= 1) {
    return [
      {
        id: `${block.id}-0`,
        title: block.title,
        content,
      },
    ];
  }

  return listItems.map((item, index) => ({
    id: `${block.id}-${index}`,
    title: `${block.title} ${index + 1}`,
    content: item,
  }));
}

function highlightLuauLine(line: string) {
  const parts = line.split(/(--.*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g);

  return parts.map((part, index) => {
    if (!part) {
      return null;
    }

    if (part.startsWith("--")) {
      return (
        <span key={`${part}-${index}`} className="text-slate-500">
          {part}
        </span>
      );
    }

    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      return (
        <span key={`${part}-${index}`} className="text-amber-300">
          {part}
        </span>
      );
    }

    if (/^\d/.test(part)) {
      return (
        <span key={`${part}-${index}`} className="text-forge-cyan">
          {part}
        </span>
      );
    }

    if (luauKeywords.has(part)) {
      return (
        <span key={`${part}-${index}`} className="font-semibold text-forge-violet">
          {part}
        </span>
      );
    }

    if (/^(game|script|workspace|Instance|Vector3|CFrame|Color3|UDim2|Enum|task|math|string|table)$/.test(part)) {
      return (
        <span key={`${part}-${index}`} className="text-forge-cyan">
          {part}
        </span>
      );
    }

    return (
      <span key={`${part}-${index}`} className="text-slate-200">
        {part}
      </span>
    );
  });
}

function resultToMarkdown(result: ResultPayload): string {
  const bulletText = result.bullets?.map((bullet) => `- ${bullet}`).join("\n");
  const blockText = result.blocks
    .map((block) => {
      const fence = block.language === "Luau" ? "lua" : "";
      return `## ${block.title}\n\n\`\`\`${fence}\n${block.content}\n\`\`\``;
    })
    .join("\n\n");

  return [`# ${result.title}`, result.summary, bulletText, blockText].filter(Boolean).join("\n\n");
}

function stripCodeFence(content: string): string {
  return content.replace(/^```(?:lua|luau|text|plaintext)?\s*/i, "").replace(/\s*```$/i, "");
}

function filenameFromTitle(title: string): string {
  if (/corrected/i.test(title)) {
    return "CorrectedScript.server.lua";
  }

  if (/local/i.test(title)) {
    return "ClientScript.client.lua";
  }

  return "GeneratedScript.server.lua";
}

function sanitizeFilename(name: string): string {
  const trimmed = name.replace(/[\\/:*?"<>|]/g, "").trim() || "GeneratedScript";

  if (/\.(lua|luau)$/i.test(trimmed)) {
    return trimmed;
  }

  if (/local/i.test(trimmed)) {
    return `${trimmed}.client.lua`;
  }

  if (/module/i.test(trimmed)) {
    return `${trimmed}.lua`;
  }

  return `${trimmed}.server.lua`;
}
