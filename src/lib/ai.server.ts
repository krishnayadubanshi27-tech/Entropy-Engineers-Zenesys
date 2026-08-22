/**
 * AI provider module — server-only.
 *
 * This is the single place that knows which model serves analysis and
 * chat. Today it calls Lovable AI Gateway (google/gemini-3.7-flash).
 * To move to your own backend or a local model (e.g. WebLLM), reimplement
 * analyzeContractText / chatAboutContract against your endpoint and keep
 * the signatures — nothing else in the app changes.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import type { ContractAnalysis } from "@/services/types";

const MODEL_ID = "google/gemini-3.7-flash";
/** Keep prompts well inside model limits; ~24k chars ≈ 6–8k tokens. */
const MAX_CONTRACT_CHARS = 24_000;

function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

function getModel() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured: missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key)(MODEL_ID);
}

export async function extractTextFromPdfBase64(pdfBase64: string): Promise<{ text: string }> {
  const { extractText } = await import("unpdf");
  const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const result = await extractText(bytes, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  const cleaned = (text ?? "").trim();
  if (!cleaned) {
    throw new Error("Could not extract text from this PDF — it may be scanned images only.");
  }
  return { text: cleaned };
}

const analysisSchema = z.object({
  summary: z.string(),
  riskScore: z.number(),
  clauses: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      impact: z.enum(["positive", "negative", "neutral"]),
      note: z.string(),
    }),
  ),
  compliance: z.array(
    z.object({
      item: z.string(),
      status: z.enum(["pass", "attention", "fail"]),
      detail: z.string(),
    }),
  ),
  deadlines: z.array(
    z.object({
      label: z.string(),
      date: z.string(),
      kind: z.string(),
    }),
  ),
  recommendations: z.array(z.string()),
});

function truncate(text: string): string {
  return text.length > MAX_CONTRACT_CHARS
    ? `${text.slice(0, MAX_CONTRACT_CHARS)}\n\n[...document truncated for analysis...]`
    : text;
}

const ANALYSIS_PROMPT = `You are EnContract, a contract and compliance analysis engine. Analyze the contract below and return a structured assessment.

Rules:
- summary: 3-5 sentence plain-language summary of the document.
- riskScore: integer 0-100 (0 = no risk, 100 = severe risk) weighing liability, termination, payment, IP, and ambiguity.
- clauses: the 6-12 most important clauses. impact is "positive" when the clause protects or benefits the signing party, "negative" when it creates risk or obligation, otherwise "neutral". Keep note to one sentence.
- compliance: 4-8 standard compliance checks for this contract type (e.g. governing law present, termination notice period, data protection, liability cap, renewal terms). status: "pass" if clearly addressed, "attention" if partial/ambiguous, "fail" if missing or risky.
- deadlines: every date-driven obligation found (renewal, expiry, notice windows, payment milestones). date as ISO YYYY-MM-DD when known, otherwise the raw text. kind: "renewal" | "expiry" | "notice" | "payment" | "other".
- recommendations: 3-6 concrete next steps for the signing party.

Contract title: `;

export async function analyzeContractText(
  title: string,
  text: string,
): Promise<Omit<ContractAnalysis, "analyzedAt">> {
  const model = getModel();
  try {
    const result = streamText({
      model,
      output: Output.object({ schema: analysisSchema }),
      prompt: `${ANALYSIS_PROMPT}"${title}"\n\n---\n\n${truncate(text)}`,
    });
    const output = await result.output;
    if (!output) throw new Error("The AI returned an empty analysis. Please try again.");
    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      // Model produced malformed JSON — try to salvage it instead of crashing.
      const raw = error.text ?? "";
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          const parsed = analysisSchema.parse(JSON.parse(raw.slice(start, end + 1)));
          return parsed;
        } catch {
          /* fall through to the thrown error below */
        }
      }
      throw new Error("The AI analysis came back malformed. Please try again.");
    }
    throw error;
  }
}

const CHAT_SYSTEM = `You are EnContract's AI assistant — a precise contract and compliance copilot. You are answering questions about ONE contract the user uploaded. Ground every answer in the contract text; quote or reference specific clauses when relevant. Flag risks plainly. If something is not in the document, say so instead of guessing. Use short markdown formatting: bold for clause names, bullet lists for steps. You are not a lawyer — end risk-heavy answers with a brief note to consult counsel.`;

export async function chatAboutContract(
  title: string,
  text: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ reply: string }> {
  const model = getModel();
  const result = streamText({
    model,
    system: `${CHAT_SYSTEM}\n\nContract title: "${title}"\n\nContract text:\n---\n${truncate(text)}\n---`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const reply = (await result.text).trim();
  if (!reply) throw new Error("The AI assistant returned an empty reply. Please try again.");
  return { reply };
}
