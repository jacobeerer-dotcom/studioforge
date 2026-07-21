# StudioForge AI

> Build Roblox experiences faster with AI.
>
> Generate Luau systems, debug scripts, and recreate Roblox UI from screenshots using OpenAI-powered workflows.

---

## What is StudioForge AI?

StudioForge AI is an AI-powered workspace designed specifically for Roblox developers.

Instead of switching between documentation, forums, debugging tools, and UI references, developers can use a single interface to:

- Generate complete Roblox systems from natural language
- Debug and improve Luau scripts
- Recreate interfaces from screenshots
- Accelerate prototyping and development workflows

StudioForge AI combines modern AI models with Roblox-specific prompting to help creators spend less time troubleshooting and more time building.

---

## Features

### 🔨 Build

Describe a Roblox feature in plain English and receive:

- Production-ready Luau code
- Recommended Explorer hierarchy
- Setup instructions
- Roblox-specific implementation guidance

Example:

> "Create a daily rewards system with streaks and DataStore support."

StudioForge AI generates the required structure and implementation plan automatically.

---

### 🛠 Fix

Paste broken Luau code and StudioForge AI will:

- Identify errors
- Explain the root cause
- Suggest improvements
- Return a corrected version of the script

Designed to help developers debug faster and learn along the way.

---

### 👁 UI Vision

Upload a screenshot of a Roblox interface and StudioForge AI can:

- Analyze the layout
- Identify UI components
- Suggest Explorer structure
- Generate implementation guidance

Perfect for quickly recreating menus, inventories, shops, HUDs, and other interfaces.

---

## Built With

- Next.js
- TypeScript
- Tailwind CSS
- OpenAI Responses API
- GPT-5-mini
- Google Gemini (fallback provider)

---

## How Codex Helped Build StudioForge AI

Codex played a significant role throughout development.

It was used to:

- Design application architecture
- Build and refine React components
- Create API integrations
- Debug TypeScript issues
- Refactor application logic
- Improve developer workflows
- Iterate on Roblox-specific prompting strategies

Rather than serving as a simple code generator, Codex acted as a collaborative development partner that accelerated implementation and experimentation.

---

## Getting Started

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
OPENAI_API_KEY=your_api_key
```

### Run Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Vision

Roblox development often involves repetitive scripting, debugging, and UI recreation tasks.

StudioForge AI aims to reduce that friction by providing specialized AI workflows built specifically around Roblox creators and the Luau ecosystem.

The goal is simple:

**Move from idea to implementation faster.**

---

## Repository

GitHub:
https://github.com/jacobeerer-dotcom/studioforge
