export type ChatContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: ChatContent[];
};

export async function* streamChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stream: true, model, messages }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`SambaNova error ${res.status}: ${res.statusText} ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.replace(/^data:\s*/, "");
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore keep-alives
      }
    }
  }
}

export function extractCodeFromMarkdown(markdown: string): string | null {
  // Try to find fenced code blocks first
  const fence = /```[a-zA-Z]*\n([\s\S]*?)```/m.exec(markdown);
  if (fence && fence[1]) return fence[1].trim();
  // Fallback to raw HTML presence
  if (/<html[\s>]/i.test(markdown) || /<!doctype html>/i.test(markdown)) return markdown;
  return null;
}


