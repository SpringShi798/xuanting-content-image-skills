import path from "node:path";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import type { CliArgs } from "../types";

const GRSAI_KNOWN_MODELS = [
  "nano-banana",
  "nano-banana-fast",
  "nano-banana-2",
  "nano-banana-2-cl",
  "nano-banana-2-4k-cl",
  "nano-banana-pro",
  "nano-banana-pro-cl",
  "nano-banana-pro-vip",
  "nano-banana-pro-4k-vip",
];

export function getDefaultModel(): string {
  return process.env.GRSAI_IMAGE_MODEL || "nano-banana-pro";
}

export function isGrsaiModel(model: string): boolean {
  const normalized = model.trim();
  return (
    GRSAI_KNOWN_MODELS.includes(normalized) ||
    normalized.startsWith("nano-banana")
  );
}

function getGrsaiApiKey(): string | null {
  return process.env.GRSAI_API_KEY || null;
}

function getGrsaiBaseUrl(): string {
  const base = process.env.GRSAI_BASE_URL || "https://grsaiapi.com";
  return base.replace(/\/+$/g, "");
}

function getGrsaiImageSize(args: CliArgs): "1K" | "2K" | "4K" {
  if (args.imageSize) return args.imageSize as "1K" | "2K" | "4K";
  return args.quality === "2k" ? "2K" : "1K";
}

function getHttpProxy(): string | null {
  return (
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    null
  );
}

interface GrsaiResponse {
  id?: string;
  status?: "running" | "violation" | "succeeded" | "failed";
  results?: Array<{ url: string }>;
  progress?: number;
  error?: string;
  message?: string;
}

async function postGrsaiViaCurl(
  payload: unknown,
  apiKey: string,
): Promise<GrsaiResponse> {
  const url = `${getGrsaiBaseUrl()}/v1/api/generate`;
  const proxy = getHttpProxy();
  const bodyStr = JSON.stringify(payload);
  const args = [
    "-s",
    "--connect-timeout",
    "30",
    "--max-time",
    "300",
    ...(proxy ? ["-x", proxy] : []),
    url,
    "-H",
    "Content-Type: application/json",
    "-H",
    `Authorization: Bearer ${apiKey}`,
    "-d",
    "@-",
  ];
  let result = "";
  try {
    result = execFileSync("curl", args, {
      input: bodyStr,
      encoding: "utf8",
      maxBuffer: 100 * 1024 * 1024,
      timeout: 310000,
    });
  } catch (error) {
    const e = error as { message?: string; stderr?: string | Buffer };
    const stderrText =
      typeof e.stderr === "string"
        ? e.stderr
        : e.stderr
          ? e.stderr.toString("utf8")
          : "";
    const details = stderrText.trim() || e.message || "curl request failed";
    throw new Error(`grsai API request failed via curl: ${details}`);
  }
  if (!result || !result.trim()) {
    throw new Error(
      "grsai returned empty body — check GRSAI_API_KEY and account credit",
    );
  }
  return JSON.parse(result) as GrsaiResponse;
}

async function postGrsaiViaFetch(
  payload: unknown,
  apiKey: string,
): Promise<GrsaiResponse> {
  const url = `${getGrsaiBaseUrl()}/v1/api/generate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`grsai API error (${res.status}): ${err}`);
  }
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error(
      "grsai returned empty body — check GRSAI_API_KEY and account credit",
    );
  }
  return JSON.parse(text) as GrsaiResponse;
}

async function postGrsai(payload: unknown): Promise<GrsaiResponse> {
  const apiKey = getGrsaiApiKey();
  if (!apiKey) throw new Error("GRSAI_API_KEY is required");
  // Default to curl: Bun's fetch fails with "unknown certificate verification
  // error" under macOS system-level proxies (Surge/Clash TUN mode etc.) that
  // don't expose http_proxy env vars. curl uses macOS native networking so it
  // sees system proxies correctly. Set GRSAI_USE_FETCH=1 to opt into fetch.
  if (process.env.GRSAI_USE_FETCH === "1") {
    return postGrsaiViaFetch(payload, apiKey);
  }
  return postGrsaiViaCurl(payload, apiKey);
}

async function downloadImage(url: string): Promise<Uint8Array> {
  // Same reason as postGrsai: default to curl so macOS system proxies work.
  if (process.env.GRSAI_USE_FETCH === "1") {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Failed to download image (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const proxy = getHttpProxy();
  const args = [
    "-s",
    "-L",
    "--connect-timeout",
    "30",
    "--max-time",
    "120",
    ...(proxy ? ["-x", proxy] : []),
    "-o",
    "-",
    url,
  ];
  const buf = execFileSync("curl", args, {
    maxBuffer: 200 * 1024 * 1024,
    timeout: 130000,
  });
  return new Uint8Array(buf);
}

async function readImageAsBase64DataUrl(p: string): Promise<string> {
  const buf = await readFile(p);
  const ext = path.extname(p).toLowerCase();
  let mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
  else if (ext === ".gif") mimeType = "image/gif";
  else if (ext === ".webp") mimeType = "image/webp";
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

export async function generateImage(
  prompt: string,
  model: string,
  args: CliArgs,
): Promise<Uint8Array> {
  const refImages: string[] = [];
  for (const refPath of args.referenceImages) {
    refImages.push(await readImageAsBase64DataUrl(refPath));
  }

  const payload: Record<string, unknown> = {
    model,
    prompt,
    aspectRatio: args.aspectRatio || "1:1",
    imageSize: getGrsaiImageSize(args),
    replyType: "json",
  };
  if (refImages.length > 0) {
    payload.images = refImages;
  }

  console.log(`Generating image with grsai (${model}, ${getGrsaiImageSize(args)})...`);
  const response = await postGrsai(payload);

  if (response.status === "violation") {
    throw new Error(
      `grsai content policy violation: ${response.error || response.message || "no detail"}`,
    );
  }
  if (response.status === "failed") {
    throw new Error(
      `grsai generation failed: ${response.error || response.message || "no detail"}`,
    );
  }
  if (response.status !== "succeeded") {
    throw new Error(
      `grsai unexpected status=${response.status}; full response: ${JSON.stringify(response)}`,
    );
  }
  const url = response.results?.[0]?.url;
  if (!url) {
    throw new Error(
      `grsai returned no image URL; full response: ${JSON.stringify(response)}`,
    );
  }

  console.log("Generation completed, downloading...");
  return downloadImage(url);
}
