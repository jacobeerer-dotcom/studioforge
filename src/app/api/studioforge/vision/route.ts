import { NextResponse } from "next/server";
import type { VisionApiResponse } from "@/lib/studioforge-types";
import { createStructuredResponse, optionalString, routeErrorResponse, StudioForgeRouteError } from "@/lib/ai-engine-server";
import { robloxVisionInstructions } from "@/lib/studioforge-prompts";

export const runtime = "nodejs";

const maxImageBytes = 8 * 1024 * 1024;

const visionSchema = {
  type: "object",
  properties: {
    detectedElements: {
      type: "array",
      description: "Visible Roblox UI elements detected in the screenshot.",
      items: {
        type: "string",
      },
    },
    explorerHierarchy: {
      type: "string",
      description: "Suggested Roblox Explorer hierarchy for recreating or modifying the UI.",
    },
    luauCode: {
      type: "string",
      description: "Generated Roblox Luau code for the UI implementation.",
    },
    implementationNotes: {
      type: "string",
      description: "Practical notes, assumptions, responsive layout advice, and setup guidance.",
    },
  },
  required: ["detectedElements", "explorerHierarchy", "luauCode", "implementationNotes"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const instructions = optionalString(Object.fromEntries(formData), "instructions", 4000);

    if (!(image instanceof File)) {
      throw new StudioForgeRouteError("Upload an image before running UI Vision.");
    }

    if (!image.type.startsWith("image/")) {
      throw new StudioForgeRouteError("UI Vision accepts PNG, JPG, WebP, or another browser-supported image file.");
    }

    if (image.size === 0) {
      throw new StudioForgeRouteError("The uploaded image is empty.");
    }

    if (image.size > maxImageBytes) {
      throw new StudioForgeRouteError("The uploaded image is too large. Keep it under 8 MB.", 413);
    }

    const bytes = Buffer.from(await image.arrayBuffer());

    const result = await createStructuredResponse<VisionApiResponse>({
      systemInstruction: robloxVisionInstructions,
      input: [
        {
          type: "text",
          text: `Additional instructions:\n${instructions || "Analyze and recreate this Roblox UI as closely as possible."}`,
        },
        {
          type: "image",
          data: bytes.toString("base64"),
          mime_type: image.type,
          resolution: "high",
        },
      ],
      schema: visionSchema,
      maxOutputTokens: 5000,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, code, message } = routeErrorResponse(error);
    return NextResponse.json({ error: message, code }, { status });
  }
}
