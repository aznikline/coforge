export interface ChatMessage {
  readonly id: number;
  readonly channel: string;
  readonly author: string;
  readonly text: string;
  readonly ts: number;
}

export async function fetchMessages(channel: string): Promise<readonly ChatMessage[]> {
  const res = await fetch(`/api/messages/${encodeURIComponent(channel)}`);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const data = (await res.json()) as { messages: ChatMessage[] };
  return data.messages;
}

export async function sendChat(
  channel: string,
  text: string,
): Promise<{ reply: ChatMessage | null; error?: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text }),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status}`);
  return res.json();
}
