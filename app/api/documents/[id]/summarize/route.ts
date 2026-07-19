import { GoogleGenAI } from "@google/genai";
import { loadDocument } from "@/lib/documents";
import { docToPlainText } from "@/lib/tiptap";
import { fail, guard, ok, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

// The floating alias rather than a pinned version, deliberately. A pinned model
// was the first choice and it returned 404 in testing: Google retires specific
// versions for new API keys, so the pin would have worked on my machine and
// broken for a reviewer with their own key. The alias always resolves to a
// current model.
const MODEL = "gemini-flash-latest";
const MAX_CHARS = 24_000; // well inside the context window, and bounds cost

/**
 * Summarise a document.
 *
 * Optional by design: with no GEMINI_API_KEY configured the endpoint reports 503
 * and the UI disables the button with an explanation, so a local clone without a
 * key still runs everything else. The key lives server-side, so reviewers can use
 * the feature on the deployed app without supplying one of their own.
 */
export async function POST(_request: Request, { params }: Ctx) {
  return guard(async () => {
    const { id } = await params;
    const user = await requireUser();
    if (user instanceof Response) return user;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return fail(503, "Summaries are unavailable — no AI provider is configured.");
    }

    const doc = await loadDocument(id, user);
    if (!doc) return fail(404, "Document not found.");

    const text = docToPlainText(doc.content).trim();
    if (text.length < 80) {
      return fail(422, "There isn't enough text here to summarise yet.");
    }

    const truncated = text.length > MAX_CHARS;
    const body = text.slice(0, MAX_CHARS);

    const ai = new GoogleGenAI({ apiKey });

    let summary: string;
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  `Summarise the document below for someone who has not read it.\n\n` +
                  `Rules:\n` +
                  `- Open with one sentence saying what the document is.\n` +
                  `- Then at most five bullet points covering the substance.\n` +
                  `- Plain text only. No markdown, no preamble, no sign-off.\n` +
                  `- Use only what the document says. If it is too thin to summarise, say exactly that.\n\n` +
                  `Title: ${doc.title}\n\n---\n${body}\n---`,
              },
            ],
          },
        ],
        config: { temperature: 0.2, maxOutputTokens: 600 },
      });

      summary = (response.text ?? "").trim();
    } catch (e) {
      console.error("[summarize]", e);
      return fail(502, "The AI provider did not respond. Try again in a moment.");
    }

    if (!summary) {
      return fail(502, "The AI provider returned an empty summary.");
    }

    return ok({ summary, model: MODEL, truncated });
  });
}
