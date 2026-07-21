"use client";

import {
  Bug,
  ChevronRight,
  Code2,
  FileCode2,
  Gamepad2,
  Hammer,
  Image,
  Monitor,
  Plus,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  examplePromptBatches,
  examplePrompts,
  type BuildApiResponse,
  type FixApiResponse,
  type Mode,
  type ResultPayload,
  type VisionApiResponse,
} from "@/lib/studioforge-types";
import { ResultPanel } from "@/components/result-panel";

type ModeConfig = {
  id: Mode;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  placeholderTitle: string;
  placeholderText: string;
};

type UploadState = {
  file: File;
  previewUrl: string;
};

type StudioForgeProject = {
  id: string;
  number: number;
  name: string;
  activeMode: Mode;
  buildPrompt: string;
  visionInstructions: string;
  fixCode: string;
  fixProblem: string;
  upload: UploadState | null;
  resultByMode: Record<Mode, ResultPayload | null>;
};

type LoadingState = {
  projectId: string;
  mode: Mode;
} | null;

const modes: ModeConfig[] = [
  {
    id: "build",
    label: "Build",
    title: "Build Roblox systems from a feature brief",
    description: "Generate Explorer structure, Luau, setup steps, and implementation notes from a Roblox development prompt.",
    icon: Hammer,
    accent: "text-forge-violet",
    placeholderTitle: "Describe a system to forge",
    placeholderText: "Use an example prompt or write your own Roblox feature brief. Results will appear as a structured development handoff.",
  },
  {
    id: "vision",
    label: "UI Vision",
    title: "Translate UI screenshots into Roblox interface plans",
    description: "Upload a Roblox UI screenshot and describe the changes you want. StudioForge will infer elements and generate code.",
    icon: Monitor,
    accent: "text-forge-cyan",
    placeholderTitle: "Upload a UI screenshot",
    placeholderText: "The preview and your notes become a UI analysis with hierarchy and Luau reconstruction code.",
  },
  {
    id: "fix",
    label: "Fix Code",
    title: "Debug Roblox Luau with focused repair notes",
    description: "Paste Luau, describe the problem, and get issue detection plus corrected Roblox-ready code.",
    icon: Bug,
    accent: "text-forge-green",
    placeholderTitle: "Paste Luau to inspect",
    placeholderText: "StudioForge will show detected problems, explain the failure mode, and provide a corrected snippet.",
  },
];

function createEmptyResults(): Record<Mode, ResultPayload | null> {
  return {
    build: null,
    vision: null,
    fix: null,
  };
}

function createProject(number: number): StudioForgeProject {
  return {
    id: `project-${number}`,
    number,
    name: `Project ${number}`,
    activeMode: "build",
    buildPrompt: "",
    visionInstructions: "",
    fixCode: "",
    fixProblem: "",
    upload: null,
    resultByMode: createEmptyResults(),
  };
}

const sampleBugCode = `local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

ReplicatedStorage.GiveCoins.OnServerEvent:Connect(function(player, amount)
  player.leaderstats.Cash.Value = player.leaderstats.Cash.Value + amount
end)`;

const apiRequestTimeoutMs = 90_000;

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  return readApiResponse<T>(response);
}

async function postForm<T>(url: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    signal,
  });

  return readApiResponse<T>(response);
}

async function readApiResponse<T>(response: Response): Promise<T> {
  let payload: ApiErrorPayload | T | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload | T;
  } catch {
    if (!response.ok) {
      throw new Error("StudioForge received an unreadable server error.");
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "StudioForge request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function mapBuildResult(data: BuildApiResponse): ResultPayload {
  return {
    eyebrow: "AI Engine build result",
    title: "Roblox implementation plan",
    summary: data.explanation,
    blocks: [
      {
        id: "build-hierarchy",
        title: "Roblox Explorer hierarchy",
        language: "Explorer",
        content: data.explorerHierarchy,
      },
      {
        id: "build-code",
        title: "Generated Luau code",
        language: "Luau",
        content: data.luauCode,
      },
      {
        id: "build-setup",
        title: "Setup instructions",
        language: "Instructions",
        content: data.setupInstructions,
      },
    ],
  };
}

function mapVisionResult(data: VisionApiResponse, fileName: string): ResultPayload {
  return {
    eyebrow: "AI Engine UI Vision analysis",
    title: `Roblox UI breakdown for ${fileName}`,
    summary: data.implementationNotes,
    bullets: data.detectedElements,
    blocks: [
      {
        id: "vision-hierarchy",
        title: "Suggested Explorer hierarchy",
        language: "Explorer",
        content: data.explorerHierarchy,
      },
      {
        id: "vision-code",
        title: "Generated Luau code",
        language: "Luau",
        content: data.luauCode,
      },
      {
        id: "vision-notes",
        title: "Implementation notes",
        language: "Instructions",
        content: data.implementationNotes,
      },
    ],
  };
}

function mapFixResult(data: FixApiResponse): ResultPayload {
  return {
    eyebrow: "AI Engine Fix Code result",
    title: "Luau repair plan",
    summary: data.explanation,
    bullets: data.detectedProblems,
    blocks: [
      {
        id: "fix-problems",
        title: "Detected problems",
        language: "Instructions",
        content: data.detectedProblems.map((problem, index) => `${index + 1}. ${problem}`).join("\n"),
      },
      {
        id: "fix-code",
        title: "Corrected Luau code",
        language: "Luau",
        content: data.fixedCode,
      },
    ],
  };
}

export function StudioForgeApp() {
  const [projects, setProjects] = useState<StudioForgeProject[]>(() => [createProject(1)]);
  const [activeProjectId, setActiveProjectId] = useState("project-1");
  const [dragActive, setDragActive] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const nextProjectNumberRef = useRef(2);
  const projectsRef = useRef(projects);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects],
  );
  const activeMode = activeProject.activeMode;
  const activeConfig = useMemo(() => modes.find((item) => item.id === activeMode) ?? modes[0], [activeMode]);
  const activeLoadingMode = loadingState?.projectId === activeProject.id ? loadingState.mode : null;

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    setError(null);
    setCopiedId(null);
  }, [activeMode, activeProjectId]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
      for (const project of projectsRef.current) {
        if (project.upload?.previewUrl) {
          URL.revokeObjectURL(project.upload.previewUrl);
        }
      }
    };
  }, []);

  function cancelActiveRequest() {
    requestVersionRef.current += 1;
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setLoadingState(null);
  }

  function updateProject(projectId: string, updater: (project: StudioForgeProject) => StudioForgeProject) {
    setProjects((currentProjects) => currentProjects.map((project) => (project.id === projectId ? updater(project) : project)));
  }

  function updateActiveProject(updater: (project: StudioForgeProject) => StudioForgeProject) {
    updateProject(activeProject.id, updater);
  }

  function createNewProject() {
    cancelActiveRequest();
    setDragActive(false);
    setError(null);
    setCopiedId(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const project = createProject(nextProjectNumberRef.current);
    nextProjectNumberRef.current += 1;
    setProjects((currentProjects) => [...currentProjects, project]);
    setActiveProjectId(project.id);
  }

  function selectProject(projectId: string) {
    if (projectId === activeProject.id) {
      return;
    }

    cancelActiveRequest();
    setDragActive(false);
    setError(null);
    setCopiedId(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setActiveProjectId(projectId);
  }

  function setProjectMode(mode: Mode) {
    updateActiveProject((project) => ({
      ...project,
      activeMode: mode,
    }));
    setDragActive(false);
  }

  function clearActiveUpload() {
    if (activeProject.upload?.previewUrl) {
      URL.revokeObjectURL(activeProject.upload.previewUrl);
    }

    updateActiveProject((project) => ({
      ...project,
      upload: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function runApiRequest(projectId: string, mode: Mode, request: (signal: AbortSignal) => Promise<ResultPayload>) {
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    const controller = new AbortController();
    let requestTimedOut = false;
    const timeoutId = window.setTimeout(() => {
      requestTimedOut = true;
      controller.abort();
    }, apiRequestTimeoutMs);

    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;
    setError(null);
    setCopiedId(null);
    setLoadingState({ projectId, mode });

    try {
      const result = await request(controller.signal);
      if (requestVersion !== requestVersionRef.current || controller.signal.aborted) {
        return;
      }

      updateProject(projectId, (project) => ({
        ...project,
        resultByMode: {
          ...project.resultByMode,
          [mode]: result,
        },
      }));
    } catch (requestError) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (requestTimedOut) {
        setError("AI Engine is taking too long to respond. Try again with a shorter prompt, or switch AI provider in .env.local.");
        return;
      }

      if (controller.signal.aborted) {
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "StudioForge could not complete the request.");
    } finally {
      window.clearTimeout(timeoutId);

      if (requestVersion === requestVersionRef.current) {
        setLoadingState(null);
      }

      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }

  async function handleBuild() {
    const project = activeProject;
    const prompt = project.buildPrompt.trim();

    if (!prompt) {
      setError("Describe the Roblox feature, system, or UI you want to create first.");
      return;
    }

    await runApiRequest(project.id, "build", async (signal) => {
      const data = await postJson<BuildApiResponse>("/api/studioforge/build", {
        prompt,
      }, signal);

      return mapBuildResult(data);
    });
  }

  async function handleVisionAnalyze() {
    const project = activeProject;
    const upload = project.upload;

    if (!upload) {
      setError("Upload a Roblox UI screenshot before running UI Vision.");
      return;
    }

    await runApiRequest(project.id, "vision", async (signal) => {
      const formData = new FormData();
      formData.append("image", upload.file);
      formData.append("instructions", project.visionInstructions);

      const data = await postForm<VisionApiResponse>("/api/studioforge/vision", formData, signal);
      return mapVisionResult(data, upload.file.name);
    });
  }

  async function handleFixCode() {
    const project = activeProject;
    const code = project.fixCode.trim();

    if (!code) {
      setError("Paste the Luau code you want StudioForge to inspect.");
      return;
    }

    await runApiRequest(project.id, "fix", async (signal) => {
      const data = await postJson<FixApiResponse>("/api/studioforge/fix", {
        code,
        problem: project.fixProblem,
      }, signal);

      return mapFixResult(data);
    });
  }

  async function handleCopy(id: string, content: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Clipboard access is blocked in this browser. Select the code block text and copy it manually.");
    }
  }

  function acceptImage(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Upload a PNG, JPG, or WebP screenshot for UI Vision.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Upload an image smaller than 8 MB for UI Vision.");
      return;
    }

    setError(null);
    if (activeProject.upload?.previewUrl) {
      URL.revokeObjectURL(activeProject.upload.previewUrl);
    }

    updateActiveProject((project) => ({
      ...project,
      upload: {
        file,
        previewUrl: URL.createObjectURL(file),
      },
    }));
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    acceptImage(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    acceptImage(event.dataTransfer.files?.[0]);
  }

  return (
    <main className="min-h-screen text-slate-100">
      <div className="forge-grid min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <Sidebar
          projects={projects}
          activeProjectId={activeProject.id}
          activeMode={activeMode}
          onModeChange={setProjectMode}
          onNewProject={createNewProject}
          onProjectSelect={selectProject}
        />

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <WorkspaceHeader config={activeConfig} project={activeProject} />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
              <section key={`${activeProject.id}-${activeMode}`} className="glass-panel rounded-xl p-5">
                {activeMode === "build" ? (
                  <BuildMode
                    prompt={activeProject.buildPrompt}
                    loading={activeLoadingMode === "build"}
                    error={error}
                    onPromptChange={(value) =>
                      updateActiveProject((project) => ({
                        ...project,
                        buildPrompt: value,
                      }))
                    }
                    onSubmit={handleBuild}
                  />
                ) : null}

                {activeMode === "vision" ? (
                  <VisionMode
                    upload={activeProject.upload}
                    instructions={activeProject.visionInstructions}
                    dragActive={dragActive}
                    loading={activeLoadingMode === "vision"}
                    error={error}
                    fileInputRef={fileInputRef}
                    onInstructionsChange={(value) =>
                      updateActiveProject((project) => ({
                        ...project,
                        visionInstructions: value,
                      }))
                    }
                    onDragActiveChange={setDragActive}
                    onDrop={handleDrop}
                    onFileInput={handleFileInput}
                    onSubmit={handleVisionAnalyze}
                    onClearUpload={clearActiveUpload}
                  />
                ) : null}

                {activeMode === "fix" ? (
                  <FixMode
                    code={activeProject.fixCode}
                    problem={activeProject.fixProblem}
                    loading={activeLoadingMode === "fix"}
                    error={error}
                    onCodeChange={(value) =>
                      updateActiveProject((project) => ({
                        ...project,
                        fixCode: value,
                      }))
                    }
                    onProblemChange={(value) =>
                      updateActiveProject((project) => ({
                        ...project,
                        fixProblem: value,
                      }))
                    }
                    onSubmit={handleFixCode}
                  />
                ) : null}
              </section>

              <ResultPanel
                result={activeProject.resultByMode[activeMode]}
                loading={activeLoadingMode === activeMode}
                placeholderTitle={activeConfig.placeholderTitle}
                placeholderText={activeConfig.placeholderText}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Sidebar({
  projects,
  activeProjectId,
  activeMode,
  onModeChange,
  onNewProject,
  onProjectSelect,
}: {
  projects: StudioForgeProject[];
  activeProjectId: string;
  activeMode: Mode;
  onModeChange: (mode: Mode) => void;
  onNewProject: () => void;
  onProjectSelect: (projectId: string) => void;
}) {
  return (
    <aside className="border-b border-white/10 bg-[#090a14]/88 px-4 py-4 backdrop-blur-xl lg:min-h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="flex items-center justify-between gap-4 lg:block">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-forge-purple/40 bg-forge-purple/15 shadow-inner-line">
            <Gamepad2 className="h-6 w-6 text-forge-violet" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-white">StudioForge AI</h1>
            <p className="truncate text-xs text-slate-400">Roblox developer cockpit</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewProject}
          aria-label="Start a new StudioForge project"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-forge-purple px-3 text-sm font-semibold text-white shadow-lg shadow-forge-purple/20 transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-forge-violet/70 lg:mt-7 lg:w-full lg:justify-center"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Project</span>
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Saved projects</p>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-400">{projects.length}</span>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:max-h-56 lg:block lg:space-y-2 lg:overflow-y-auto lg:pb-0 lg:pr-1">
          {projects.map((project) => {
            const active = project.id === activeProjectId;
            const savedResultCount = Object.values(project.resultByMode).filter(Boolean).length;
            const modeLabel = modes.find((item) => item.id === project.activeMode)?.label ?? "Build";
            const status = savedResultCount > 0 ? `${savedResultCount} result${savedResultCount === 1 ? "" : "s"}` : "Draft";

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onProjectSelect(project.id)}
                aria-current={active ? "true" : undefined}
                className={`group min-w-[170px] rounded-lg border px-3 py-3 text-left transition lg:w-full ${
                  active
                    ? "border-forge-purple/55 bg-forge-purple/15 text-white"
                    : "border-white/0 bg-white/[0.025] text-slate-400 hover:border-white/10 hover:bg-white/[0.055] hover:text-slate-100"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{project.name}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-forge-violet" : "bg-slate-700 group-hover:bg-slate-500"}`} />
                </span>
                <span className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="truncate">{modeLabel}</span>
                  <span className="shrink-0">{status}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-6 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
        {modes.map((item) => {
          const Icon = item.icon;
          const active = activeMode === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              aria-current={active ? "page" : undefined}
              className={`group flex min-w-[145px] items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition lg:w-full ${
                active
                  ? "border-forge-purple/45 bg-forge-purple/15 text-white"
                  : "border-white/0 bg-white/[0.025] text-slate-400 hover:border-white/10 hover:bg-white/[0.055] hover:text-slate-100"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
                    active ? "bg-forge-purple/20 text-forge-violet" : "bg-white/[0.055] text-slate-500 group-hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-medium">{item.label}</span>
              </span>
              <ChevronRight className={`h-4 w-4 shrink-0 transition ${active ? "text-forge-violet" : "text-slate-600"}`} />
            </button>
          );
        })}
      </nav>

      <div className="mt-7 hidden rounded-lg border border-white/10 bg-white/[0.035] p-4 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Secure API engine</p>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-forge-violet" />
            AI Engine
          </div>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-forge-cyan" />
            Luau output blocks
          </div>
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-forge-green" />
            Explorer mapping
          </div>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ config, project }: { config: ModeConfig; project: StudioForgeProject }) {
  const Icon = config.icon;

  return (
    <header className="glass-panel rounded-xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.045]">
            <Icon className={`h-6 w-6 ${config.accent}`} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">StudioForge workspace</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{config.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{config.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <StatusPill label={project.name} />
          <StatusPill label="App Router" />
          <StatusPill label="AI Engine" tone="purple" />
          <StatusPill label="Roblox Luau" tone="green" />
        </div>
      </div>
    </header>
  );
}

function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "purple" | "green" }) {
  const toneClass =
    tone === "purple"
      ? "border-forge-purple/30 bg-forge-purple/10 text-forge-violet"
      : tone === "green"
        ? "border-forge-green/25 bg-forge-green/10 text-forge-green"
        : "border-white/10 bg-white/[0.04] text-slate-300";

  return <span className={`rounded-md border px-3 py-1.5 text-xs font-medium ${toneClass}`}>{label}</span>;
}

function BuildMode({
  prompt,
  loading,
  error,
  onPromptChange,
  onSubmit,
}: {
  prompt: string;
  loading: boolean;
  error: string | null;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [exampleBatchIndex, setExampleBatchIndex] = useState(0);
  const visibleExamplePrompts = examplePromptBatches[exampleBatchIndex % examplePromptBatches.length] ?? examplePrompts;

  function loadNewExamplePrompts() {
    setExampleBatchIndex((current) => (current + 1) % examplePromptBatches.length);
  }

  return (
    <div className="space-y-5">
      <SectionIntro
        icon={Wand2}
        title="Build brief"
        description="Tell StudioForge what you want to create in Roblox Studio. The assistant will generate a practical blueprint from your prompt."
      />

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Feature prompt</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={9}
          placeholder="Example: Create a daily rewards system with streak tracking, server validation, and a clean claim UI."
          className="min-h-[230px] w-full resize-y rounded-lg border border-white/10 bg-[#0a0b14] px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-purple/60 focus:ring-2 focus:ring-forge-purple/20"
        />
      </label>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Example prompts</h3>
          <button
            type="button"
            onClick={loadNewExamplePrompts}
            aria-label="Load new example prompts"
            className="rounded-md border border-forge-purple/25 bg-forge-purple/10 px-2.5 py-1.5 text-xs font-semibold text-forge-violet transition hover:border-forge-purple/50 hover:bg-forge-purple/20 focus:outline-none focus:ring-2 focus:ring-forge-purple/40"
          >
            Click to load
          </button>
        </div>
        <div className="grid gap-3">
          {visibleExamplePrompts.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onPromptChange(example)}
              className="group rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-forge-purple/40 hover:bg-forge-purple/10 focus:outline-none focus:ring-2 focus:ring-forge-purple/30"
            >
              <span className="block text-sm leading-6 text-slate-300">{example}</span>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-forge-violet opacity-80 transition group-hover:opacity-100">
                Load prompt
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <ErrorMessage error={error} />

      <PrimaryAction loading={loading} idleLabel="Generate" loadingLabel="Generating" onClick={onSubmit} />
    </div>
  );
}

function VisionMode({
  upload,
  instructions,
  dragActive,
  loading,
  error,
  fileInputRef,
  onInstructionsChange,
  onDragActiveChange,
  onDrop,
  onFileInput,
  onSubmit,
  onClearUpload,
}: {
  upload: UploadState | null;
  instructions: string;
  dragActive: boolean;
  loading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onInstructionsChange: (value: string) => void;
  onDragActiveChange: (value: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onClearUpload: () => void;
}) {
  return (
    <div className="space-y-5">
      <SectionIntro
        icon={Image}
        title="UI Vision input"
        description="Drop in a Roblox UI screenshot, then add the change request or recreation goal for the vision analyzer."
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          onDragActiveChange(true);
        }}
        onDragLeave={() => onDragActiveChange(false)}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed p-4 transition ${
          dragActive ? "border-forge-cyan/70 bg-forge-cyan/10" : "border-white/15 bg-[#0a0b14]"
        }`}
      >
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileInput} />

        {upload ? (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black">
              <img src={upload.previewUrl} alt="Uploaded Roblox UI preview" className="max-h-[330px] w-full object-contain" />
              <button
                type="button"
                onClick={onClearUpload}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-black/70 text-slate-200 backdrop-blur transition hover:bg-black"
                aria-label="Remove uploaded screenshot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
              <span className="min-w-0 truncate">{upload.file.name}</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-forge-cyan/50 hover:bg-forge-cyan/10"
              >
                Replace image
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] px-5 text-center transition hover:border-forge-cyan/50 hover:bg-forge-cyan/10 focus:outline-none focus:ring-2 focus:ring-forge-cyan/25"
          >
            <span className="grid h-14 w-14 place-items-center rounded-xl border border-forge-cyan/30 bg-forge-cyan/10">
              <Upload className="h-6 w-6 text-forge-cyan" />
            </span>
            <span className="mt-4 text-base font-semibold text-slate-100">Drop a screenshot or browse</span>
            <span className="mt-2 max-w-sm text-sm leading-6 text-slate-500">PNG, JPG, and WebP previews are supported in this prototype.</span>
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Additional instructions</span>
        <textarea
          value={instructions}
          onChange={(event) => onInstructionsChange(event.target.value)}
          rows={5}
          placeholder="Example: Recreate this inventory menu, but make the equip button larger and easier to tap on mobile."
          className="w-full resize-y rounded-lg border border-white/10 bg-[#0a0b14] px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-cyan/60 focus:ring-2 focus:ring-forge-cyan/20"
        />
      </label>

      <ErrorMessage error={error} />

      <PrimaryAction loading={loading} idleLabel="Analyze" loadingLabel="Analyzing" onClick={onSubmit} tone="cyan" />
    </div>
  );
}

function FixMode({
  code,
  problem,
  loading,
  error,
  onCodeChange,
  onProblemChange,
  onSubmit,
}: {
  code: string;
  problem: string;
  loading: boolean;
  error: string | null;
  onCodeChange: (value: string) => void;
  onProblemChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-5">
      <SectionIntro
        icon={Bug}
        title="Luau repair bench"
        description="Paste Roblox Luau and describe the issue. StudioForge returns likely bugs, reasoning, and a corrected server-safe pattern."
      />

      <label className="block">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-200">Luau code</span>
          <button
            type="button"
            onClick={() => onCodeChange(sampleBugCode)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-forge-green/40 hover:bg-forge-green/10"
          >
            Load sample bug
          </button>
        </div>
        <textarea
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          rows={13}
          spellCheck={false}
          placeholder="Paste Roblox Luau here..."
          className="min-h-[310px] w-full resize-y rounded-lg border border-white/10 bg-[#080912] px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-green/60 focus:ring-2 focus:ring-forge-green/20"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Problem description</span>
        <textarea
          value={problem}
          onChange={(event) => onProblemChange(event.target.value)}
          rows={4}
          placeholder="Example: Players can give themselves too many coins and sometimes Cash is nil."
          className="w-full resize-y rounded-lg border border-white/10 bg-[#0a0b14] px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-forge-green/60 focus:ring-2 focus:ring-forge-green/20"
        />
      </label>

      <ErrorMessage error={error} />

      <PrimaryAction loading={loading} idleLabel="Fix Code" loadingLabel="Fixing" onClick={onSubmit} tone="green" />
    </div>
  );
}

function SectionIntro({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/[0.055] text-forge-violet">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100" role="alert">
      {error}
    </div>
  );
}

function PrimaryAction({
  loading,
  idleLabel,
  loadingLabel,
  onClick,
  tone = "purple",
}: {
  loading: boolean;
  idleLabel: string;
  loadingLabel: string;
  onClick: () => void;
  tone?: "purple" | "cyan" | "green";
}) {
  const toneClass =
    tone === "cyan"
      ? "bg-forge-cyan text-slate-950 hover:bg-cyan-300 focus:ring-forge-cyan/50 shadow-forge-cyan/15"
      : tone === "green"
        ? "bg-forge-green text-slate-950 hover:bg-emerald-300 focus:ring-forge-green/50 shadow-forge-green/15"
        : "bg-forge-purple text-white hover:bg-violet-500 focus:ring-forge-violet/60 shadow-forge-purple/20";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold shadow-lg transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70 ${toneClass}`}
    >
      <Sparkles className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
      <span>{loading ? loadingLabel : idleLabel}</span>
    </button>
  );
}
