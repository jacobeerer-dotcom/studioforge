import { GoogleGenAI, type ContentListUnion, type PartUnion } from "@google/genai";

type AIEngineProvider = "gemini" | "openai";
type AIEngineProviderSetting = AIEngineProvider | "auto";

type JsonSchemaObject = {
  type: "object";
  properties: Record<string, unknown>;
  required: readonly string[];
  additionalProperties?: boolean;
};

type AIEngineContentInput =
  | string
  | Array<
      | {
          type: "text";
          text: string;
        }
      | {
          type: "image";
          data: string;
          mime_type: string;
          resolution?: "low" | "medium" | "high" | "ultra_high";
        }
    >;

type StructuredResponseOptions = {
  systemInstruction: string;
  input: AIEngineContentInput;
  schema: JsonSchemaObject;
  maxOutputTokens?: number;
};

type OpenAIContentPart =
  | {
      type: "input_text";
      text: string;
    }
  | {
      type: "input_image";
      image_url: string;
      detail: "low" | "high" | "auto";
    };

type OpenAIResponseBody = {
  output_text?: unknown;
  output?: unknown;
  error?: unknown;
};

const AI_ENGINE_TIMEOUT_MS = 75_000;

export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export class StudioForgeRouteError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "studioforge_error") {
    super(message);
    this.name = "StudioForgeRouteError";
    this.status = status;
    this.code = code;
  }
}

function getConfiguredAIEngineProvider(): AIEngineProviderSetting {
  const configuredProvider = process.env.AI_ENGINE_PROVIDER?.trim().toLowerCase();

  if (!configuredProvider || configuredProvider === "auto") {
    return "auto";
  }

  if (configuredProvider === "gemini" || configuredProvider === "openai") {
    return configuredProvider;
  }

  throw new StudioForgeRouteError("AI Engine provider must be gemini, openai, or auto.", 500, "invalid_ai_engine_provider");
}

export function getAIEngineProvider(): AIEngineProvider {
  const configuredProvider = getConfiguredAIEngineProvider();

  if (configuredProvider !== "auto") {
    return configuredProvider;
  }

  if (process.env.GEMINI_API_KEY?.trim()) {
    return "gemini";
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    return "openai";
  }

  throw new StudioForgeRouteError("AI Engine API key is not configured on the server. Add OPENAI_API_KEY or GEMINI_API_KEY to .env.local.", 500, "missing_api_key");
}

export function getAIEngineModel(provider = getAIEngineProvider()) {
  if (provider === "openai") {
    return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  }

  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getAIEngineClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new StudioForgeRouteError("Gemini API key is not configured on the server. Add GEMINI_API_KEY to .env.local.", 500, "missing_gemini_api_key");
  }

  return new GoogleGenAI({ apiKey });
}

export async function createStructuredResponse<T>({
  systemInstruction,
  input,
  schema,
  maxOutputTokens = 4096,
}: StructuredResponseOptions): Promise<T> {
  const configuredProvider = getConfiguredAIEngineProvider();
  const provider = getAIEngineProvider();

  if (provider === "openai") {
    try {
      return await createOpenAIStructuredResponse<T>({
        systemInstruction,
        input,
        schema,
        maxOutputTokens,
      });
    } catch (error) {
      if (configuredProvider === "auto" && canFallbackFromOpenAIToGemini(error)) {
        console.warn("[StudioForge] OpenAI provider failed in auto mode; retrying with Gemini.");
        return createGeminiStructuredResponse<T>({
          systemInstruction,
          input,
          schema,
          maxOutputTokens,
        });
      }

      throw error;
    }
  }

  try {
    return await createGeminiStructuredResponse<T>({
      systemInstruction,
      input,
      schema,
      maxOutputTokens,
    });
  } catch (error) {
    if (configuredProvider === "auto" && canFallbackFromGeminiToOpenAI(error)) {
      console.warn("[StudioForge] Gemini provider failed in auto mode; retrying with OpenAI.");
      return createOpenAIStructuredResponse<T>({
        systemInstruction,
        input,
        schema,
        maxOutputTokens,
      });
    }

    throw error;
  }
}

async function createGeminiStructuredResponse<T>({
  systemInstruction,
  input,
  schema,
  maxOutputTokens,
}: Required<StructuredResponseOptions>): Promise<T> {
  let response: Awaited<ReturnType<ReturnType<typeof getAIEngineClient>["models"]["generateContent"]>>;

  try {
    response = await withAIEngineDeadline((abortSignal) =>
      getAIEngineClient().models.generateContent({
        model: getAIEngineModel("gemini"),
        contents: toGeminiContent(input),
        config: {
          abortSignal,
          systemInstruction,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0.35,
        },
      }),
    );
  } catch (error) {
    throwGeminiError(error);
  }

  return parseStructuredOutput<T>(response.text);
}

async function createOpenAIStructuredResponse<T>({
  systemInstruction,
  input,
  schema,
  maxOutputTokens,
}: Required<StructuredResponseOptions>): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new StudioForgeRouteError("OpenAI API key is not configured on the server. Add OPENAI_API_KEY to .env.local.", 500, "missing_openai_api_key");
  }

  const response = await withAIEngineDeadline((signal) =>
    fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        model: getAIEngineModel("openai"),
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: systemInstruction,
              },
            ],
          },
          {
            role: "user",
            content: toOpenAIContent(input),
          },
        ],
        max_output_tokens: maxOutputTokens,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "studioforge_response",
            schema,
            strict: true,
          },
        },
      }),
    }),
  );

  const body = (await response.json().catch(() => null)) as OpenAIResponseBody | null;

  if (!response.ok) {
    throwOpenAIError(response.status, body);
  }

  return parseStructuredOutput<T>(extractOpenAIOutputText(body));
}

function toGeminiContent(input: AIEngineContentInput): ContentListUnion {
  if (typeof input === "string") {
    return input;
  }

  return input.map((part): PartUnion => {
    if (part.type === "text") {
      return {
        text: part.text,
      };
    }

    return {
      inlineData: {
        data: part.data,
        mimeType: part.mime_type,
      },
    };
  });
}

function toOpenAIContent(input: AIEngineContentInput): OpenAIContentPart[] {
  if (typeof input === "string") {
    return [
      {
        type: "input_text",
        text: input,
      },
    ];
  }

  return input.map((part) => {
    if (part.type === "text") {
      return {
        type: "input_text",
        text: part.text,
      };
    }

    return {
      type: "input_image",
      image_url: `data:${part.mime_type};base64,${part.data}`,
      detail: toOpenAIImageDetail(part.resolution),
    };
  });
}

function toOpenAIImageDetail(resolution?: "low" | "medium" | "high" | "ultra_high"): "low" | "high" | "auto" {
  if (resolution === "low") {
    return "low";
  }

  if (resolution === "high" || resolution === "ultra_high") {
    return "high";
  }

  return "auto";
}

function parseStructuredOutput<T>(rawOutput: unknown): T {
  const output = typeof rawOutput === "string" ? rawOutput.trim() : "";

  if (!output) {
    throw new StudioForgeRouteError("AI Engine returned an empty response. Try again with a more specific request.", 502, "empty_model_response");
  }

  try {
    return JSON.parse(output) as T;
  } catch {
    throw new StudioForgeRouteError("AI Engine returned a response that could not be parsed. Please retry.", 502, "invalid_model_json");
  }
}

function extractOpenAIOutputText(body: OpenAIResponseBody | null): string {
  if (!body) {
    return "";
  }

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  const chunks: string[] = [];
  collectOpenAIText(body.output, chunks);
  return chunks.join("\n");
}

function collectOpenAIText(value: unknown, chunks: string[]) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectOpenAIText(item, chunks);
    }

    return;
  }

  const record = value as Record<string, unknown>;

  if ((record.type === "output_text" || record.type === "text") && typeof record.text === "string") {
    chunks.push(record.text);
  }

  if ("content" in record) {
    collectOpenAIText(record.content, chunks);
  }
}

function throwOpenAIError(status: number, body: OpenAIResponseBody | null): never {
  const nested = body?.error && typeof body.error === "object" ? (body.error as Record<string, unknown>) : null;
  const code = getStringValue(nested, "code") ?? getStringValue(nested, "type") ?? "openai_request_failed";
  const message = getOpenAISafeErrorMessage(status, code);

  throw new StudioForgeRouteError(message, status, code);
}

function getStringValue(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) {
    return null;
  }

  const value = record[key];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function getOpenAISafeErrorMessage(status: number, code: string): string {
  if (status === 401 || status === 403) {
    return "AI Engine rejected the OpenAI API key or project access. Check OPENAI_API_KEY, billing, and project permissions.";
  }

  if (status === 429 && code === "insufficient_quota") {
    return "OpenAI returned insufficient_quota for this key/project. This usually means no usable credits, billing, or project quota, not necessarily a negative balance. Check OpenAI billing/project limits or switch to Gemini.";
  }

  if (status === 429 && code === "rate_limit_exceeded") {
    return "AI Engine hit the OpenAI rate limit. Wait briefly, reduce requests, or switch to Gemini with AI_ENGINE_PROVIDER=gemini.";
  }

  if (status === 429) {
    return "AI Engine received a 429 from OpenAI. Check quota, billing, and request limits for this key.";
  }

  if (status === 400) {
    return "OpenAI could not process this request. Try simplifying the prompt or use a different OPENAI_MODEL.";
  }

  return "AI Engine request to OpenAI failed. Please try again in a moment.";
}

function throwGeminiError(error: unknown): never {
  if (error instanceof StudioForgeRouteError) {
    throw error;
  }

  const status = getErrorStatus(error);
  const code = getGeminiErrorCode(error);
  const message = getGeminiSafeErrorMessage(status, code, error);

  throw new StudioForgeRouteError(message, status, code);
}

function getGeminiErrorCode(error: unknown): string {
  const parsed = parseJsonErrorMessage(error);
  const parsedCode = getStringValue(parsed, "status") ?? getStringValue(parsed, "code");

  if (parsedCode) {
    return `gemini_${parsedCode.toLowerCase()}`;
  }

  const directCode = getAIEngineErrorCode(error);
  return directCode ? `gemini_${directCode.toLowerCase()}` : "gemini_request_failed";
}

function getGeminiSafeErrorMessage(status: number, code: string, error: unknown): string {
  if (status === 401 || status === 403) {
    return "Gemini rejected GEMINI_API_KEY or this Google project does not have API access. Check the key, project, and Gemini API access.";
  }

  if (status === 429) {
    return "Gemini quota or rate limit was reached for GEMINI_API_KEY. If you just changed the key, restart the dev server; otherwise check Google AI Studio quota or use OpenAI.";
  }

  if (status === 400) {
    const message = parseJsonErrorMessage(error)?.message;
    return typeof message === "string" && message.length <= 220 ? `Gemini rejected the request: ${message}` : "Gemini rejected the request. Check the selected GEMINI_MODEL or simplify the prompt.";
  }

  if (status === 503) {
    return "Gemini is temporarily overloaded or unavailable. Try again shortly or use OpenAI.";
  }

  return "Gemini request failed. Check GEMINI_API_KEY, network access, and the selected GEMINI_MODEL.";
}

function parseJsonErrorMessage(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }

  const message = (error as { message?: unknown }).message;

  if (typeof message !== "string" || !message.trim().startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(message) as unknown;

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const nested = (parsed as { error?: unknown }).error;
      return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
    }
  } catch {
    return null;
  }

  return null;
}

async function withAIEngineDeadline<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new StudioForgeRouteError("AI Engine took too long to respond. Try again, shorten the prompt, or switch provider.", 504, "ai_engine_timeout"));
    }, AI_ENGINE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new StudioForgeRouteError("AI Engine took too long to respond. Try again, shorten the prompt, or switch provider.", 504, "ai_engine_timeout");
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function canFallbackFromOpenAIToGemini(error: unknown): boolean {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return false;
  }

  if (!(error instanceof StudioForgeRouteError)) {
    return false;
  }

  return error.status === 401 || error.status === 403 || error.status === 429 || error.status === 503;
}

function canFallbackFromGeminiToOpenAI(error: unknown): boolean {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return false;
  }

  const status = getErrorStatus(error);
  return status === 401 || status === 403 || status === 429 || status === 503;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StudioForgeRouteError("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, field: string, maxLength: number): string {
  const value = body[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new StudioForgeRouteError(`${field} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new StudioForgeRouteError(`${field} is too long. Keep it under ${maxLength.toLocaleString()} characters.`);
  }

  return trimmed;
}

export function optionalString(body: Record<string, unknown>, field: string, maxLength: number): string {
  const value = body[field];

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new StudioForgeRouteError(`${field} must be text.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new StudioForgeRouteError(`${field} is too long. Keep it under ${maxLength.toLocaleString()} characters.`);
  }

  return trimmed;
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof StudioForgeRouteError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  const status = getErrorStatus(error);
  const code = getAIEngineErrorCode(error);

  if (status === 400) {
    return {
      status,
      code: code ?? "bad_request",
      message: getAIEngineMessage(error) ?? "AI Engine could not process this request. Try simplifying the input.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      code: code ?? "authentication_failed",
      message: "AI Engine rejected the server API key or project access. Check the server environment and API access.",
    };
  }

  if (status === 429) {
    return {
      status,
      code: code ?? "rate_limit_or_quota",
      message: "AI Engine rate limit or quota was reached. Wait briefly, or check quota and billing for this API key/project.",
    };
  }

  if (status === 503) {
    return {
      status,
      code: code ?? "service_unavailable",
      message: "AI Engine is temporarily overloaded or unavailable. Please try again shortly.",
    };
  }

  return {
    status: status >= 500 ? 502 : 500,
    code: code ?? "ai_engine_request_failed",
    message: "AI Engine request failed. Please try again in a moment.",
  };
}

function getErrorStatus(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return 500;
}

function getAIEngineErrorCode(error: unknown): string | null {
  const nested = getNestedError(error);

  if (nested && "code" in nested) {
    const code = (nested as { code?: unknown }).code;

    if (typeof code === "string" && code.length > 0) {
      return code;
    }

    if (typeof code === "number") {
      return String(code);
    }
  }

  if (error && typeof error === "object") {
    for (const key of ["code", "name", "statusText"]) {
      if (key in error) {
        const value = (error as Record<string, unknown>)[key];

        if (typeof value === "string" && value.length > 0) {
          return value;
        }
      }
    }
  }

  return null;
}

function getAIEngineMessage(error: unknown): string | null {
  const nested = getNestedError(error);

  if (nested && "message" in nested) {
    const message = (nested as { message?: unknown }).message;

    if (typeof message === "string" && message.length <= 500) {
      return message;
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.length <= 500) {
      return message;
    }
  }

  return null;
}

function getNestedError(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== "object" || !("error" in error)) {
    return null;
  }

  const nested = (error as { error?: unknown }).error;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}
