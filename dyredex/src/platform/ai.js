// AI for the standalone app: the user's own Anthropic API key, kept only on this device.
// It offers the same json()/limits() calls as the Claude runtime's `sample`, and rejects with the same
// {code, message} shape, so the scanning code is shared.
import Anthropic from "@anthropic-ai/sdk";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Bedst til at genkende arter (standard)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Billigere, næsten lige så god" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Billigst og hurtigst, mindre sikker på sjældne arter" },
];
export const DEFAULT_MODEL = MODELS[0].id;

const KEY = "dyredex-apikey", MODEL = "dyredex-model";
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} },
};
export const aiSettings = {
  hasKey: () => !!ls.get(KEY),
  setKey: k => ls.set(KEY, String(k || "").trim()),
  model: () => (MODELS.some(m => m.id === ls.get(MODEL)) ? ls.get(MODEL) : DEFAULT_MODEL),
  setModel: m => ls.set(MODEL, MODELS.some(x => x.id === m) ? m : ""),
};

const fail = (code, message, text) => Object.assign(new Error(message), { code, ...(text ? { text } : {}) });

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
const MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// The reply should be bare JSON; tolerate a code fence or a sentence around it.
export function parseJson(text) {
  const t = String(text || "").trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : t;
  try { return JSON.parse(body); } catch {}
  const start = body.search(/[[{]/);
  if (start >= 0) {
    const close = body[start] === "{" ? "}" : "]";
    const end = body.lastIndexOf(close);
    if (end > start) { try { return JSON.parse(body.slice(start, end + 1)); } catch {} }
  }
  throw fail("invalid_json", "The reply held no parseable JSON.", t);
}

export function createAi() {
  const apiKey = ls.get(KEY);
  if (!apiKey) return null;
  // The key is the user's own and never leaves this device except to api.anthropic.com.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  async function json(prompt, opts = {}) {
    const model = aiSettings.model();
    const content = [];
    for (const img of opts.images || []) {
      content.push({ type: "image", source: { type: "base64", media_type: MEDIA.includes(img.type) ? img.type : "image/jpeg", data: await toBase64(img) } });
    }
    content.push({ type: "text", text: String(prompt) });
    const params = {
      model,
      max_tokens: 16000,
      system: "Du er motoren i en dyre-app. Svar altid med præcis ét gyldigt JSON-objekt eller -array og intet andet: ingen forklaring og ingen markdown.",
      messages: [{ role: "user", content }],
      output_config: { effort: opts.modelTier === "quick" ? "low" : "medium" },
    };
    // A declined request is re-run on Anthropic's recommended fallback model inside the same call (not on Haiku, which has none).
    if (!model.startsWith("claude-haiku")) Object.assign(params, { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    let res;
    try {
      res = await client.beta.messages.create(params, { signal: opts.signal });
    } catch (e) {
      if (e instanceof Anthropic.APIUserAbortError || opts.signal?.aborted) throw fail("cancelled", "Aborted.");
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw fail("bad_key", e.message);
      if (e instanceof Anthropic.RateLimitError) throw fail("rate_limited", e.message);
      if (e instanceof Anthropic.BadRequestError) throw fail("bad_request", e.message);
      if (e instanceof Anthropic.APIError) throw fail("upstream_error", e.message);
      throw fail("upstream_error", String(e?.message || e));
    }
    if (res.stop_reason === "refusal") throw fail("refused", "Claude declined this input.");
    const text = res.content.filter(b => b.type === "text").map(b => b.text).join("");
    if (!text.trim()) throw fail("empty_completion", "No text.");
    return parseJson(text);
  }

  return {
    json,
    limits: async () => ({ images: { maxCount: 4 } }),
  };
}
