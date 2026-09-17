import env from "../../../config/env.js";

export class OpenAICompatProvider {
  id = "openai-aicompat";

  isAvailable() {
    return env.aiProvider === "openai-aicompat" && env.openaiApiKey.length > 0;
  }

  async ask(request, ctx) {
    const system = [
      "You are DevForge AI, an embedded assistant for a developer command center.",
      "Your answers are concise, technical and structured with markdown.",
      "You may reference the provided workspace context, but never invent data.",
      "Respond with: content (markdown), optional actions (label + href), optional severity (low|medium|high) and confidence (0-1).",
      "Return JSON exactly in the shape: {\"content\":string,\"actions\":[{\"label\":string,\"href\":string,\"type\":string}],\"severity\":string,\"confidence\":number}.",
    ].join("\n");

    const user = [
      `Workspace context:\n${JSON.stringify(ctx, null, 2)}`,
      `User message: ${request.message}`,
    ].join("\n\n");

    const res = await fetch(`${env.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("AI provider returned an empty response");

    try {
      const parsed = JSON.parse(raw);
      return {
        content: parsed.content ?? "No response.",
        actions: parsed.actions ?? [],
        confidence: parsed.confidence,
        severity: parsed.severity,
        sources: [],
        isDemo: false,
        providerUsed: env.openaiModel,
        contextTokens: raw.length,
      };
    } catch {
      return {
        content: raw,
        actions: [],
        isDemo: false,
        providerUsed: env.openaiModel,
        contextTokens: raw.length,
      };
    }
  }
}
