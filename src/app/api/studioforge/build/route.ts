import { NextResponse } from "next/server";
import type { BuildApiResponse } from "@/lib/studioforge-types";
import { createStructuredResponse, asRecord, requiredString, routeErrorResponse } from "@/lib/ai-engine-server";
import { robloxBuildInstructions } from "@/lib/studioforge-prompts";

export const runtime = "nodejs";

const buildSchema = {
  type: "object",
  properties: {
    explanation: {
      type: "string",
      description: "Concise explanation of the Roblox implementation approach.",
    },
    explorerHierarchy: {
      type: "string",
      description: "Tree-like Roblox Explorer hierarchy with object types and script placement.",
    },
    luauCode: {
      type: "string",
      description: "Generated Roblox Luau code.",
    },
    setupInstructions: {
      type: "string",
      description: "Step-by-step setup instructions for Roblox Studio.",
    },
  },
  required: ["explanation", "explorerHierarchy", "luauCode", "setupInstructions"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const prompt = requiredString(body, "prompt", 6000);
    console.info(`[StudioForge] /api/studioforge/build received request. promptLength=${prompt.length}`);

    const result = await createStructuredResponse<BuildApiResponse>({
      systemInstruction: robloxBuildInstructions,
      input: `Roblox feature request:\n${prompt}`,
      schema: buildSchema,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, code, message } = routeErrorResponse(error);
    return NextResponse.json({ error: message, code }, { status });
  }
}
