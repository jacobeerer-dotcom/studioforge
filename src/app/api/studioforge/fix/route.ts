import { NextResponse } from "next/server";
import type { FixApiResponse } from "@/lib/studioforge-types";
import { createStructuredResponse, asRecord, optionalString, requiredString, routeErrorResponse } from "@/lib/ai-engine-server";
import { robloxFixInstructions } from "@/lib/studioforge-prompts";

export const runtime = "nodejs";

const fixSchema = {
  type: "object",
  properties: {
    detectedProblems: {
      type: "array",
      description: "Concrete problems found in the submitted Roblox Luau code.",
      items: {
        type: "string",
      },
    },
    explanation: {
      type: "string",
      description: "Explanation of why the code fails and how the fix addresses it.",
    },
    fixedCode: {
      type: "string",
      description: "Corrected Roblox Luau code.",
    },
  },
  required: ["detectedProblems", "explanation", "fixedCode"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  try {
    const body = asRecord(await request.json());
    const code = requiredString(body, "code", 20000);
    const problem = optionalString(body, "problem", 4000);

    const result = await createStructuredResponse<FixApiResponse>({
      systemInstruction: robloxFixInstructions,
      input: `Problem description:\n${problem || "No extra description provided."}\n\nLuau code:\n\`\`\`lua\n${code}\n\`\`\``,
      schema: fixSchema,
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, code, message } = routeErrorResponse(error);
    return NextResponse.json({ error: message, code }, { status });
  }
}
