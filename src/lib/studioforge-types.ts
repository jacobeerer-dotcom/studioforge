export type Mode = "build" | "vision" | "fix";

export type ExplorerCodeBlock = {
  id: string;
  title: string;
  language: "Explorer" | "Luau" | "Instructions";
  content: string;
};

export type ResultPayload = {
  eyebrow: string;
  title: string;
  summary: string;
  bullets?: string[];
  blocks: ExplorerCodeBlock[];
};

export type BuildApiResponse = {
  explanation: string;
  explorerHierarchy: string;
  luauCode: string;
  setupInstructions: string;
};

export type FixApiResponse = {
  detectedProblems: string[];
  explanation: string;
  fixedCode: string;
};

export type VisionApiResponse = {
  detectedElements: string[];
  explorerHierarchy: string;
  luauCode: string;
  implementationNotes: string;
};

export const examplePrompts = [
  "Create a money counter with support for millions, billions, trillions and larger values.",
  "Create a Settings panel that slides in from the left using TweenService.",
  "Create a shop system with item purchasing and server-side validation.",
];

export const examplePromptBatches = [
  examplePrompts,
  [
    "Create a daily rewards system with streak bonuses, cooldown checks, and DataStoreService saving.",
    "Create a round-based lobby system with intermission timers, map voting, and safe player teleporting.",
    "Create a sprint stamina system with mobile support, server sanity checks, and a clean HUD bar.",
  ],
  [
    "Create an inventory hotbar with item slots, equip buttons, and RemoteEvent validation.",
    "Create a pet follow system with server-owned pet spawning and smooth client-side movement.",
    "Create a quest tracker UI that updates objectives from server progress events.",
  ],
  [
    "Create a VIP door that checks GamePass ownership on the server and shows a purchase prompt.",
    "Create a damage zone with debounce protection, safe character checks, and configurable damage.",
    "Create a leaderboard with wins, coins, and formatted large numbers for Roblox leaderstats.",
  ],
  [
    "Create a trading request system with accept/decline UI and server-side item validation.",
    "Create a checkpoint system for an obby with respawn saving and touch debounce.",
    "Create a notification toast UI that stacks messages and fades them out using TweenService.",
  ],
];
