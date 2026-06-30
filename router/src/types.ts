export interface AgentConfig {
  readonly name: string;
  readonly color: string;
  readonly role: string;
  readonly persona: string;
}

export interface ChatMessage {
  readonly id: number;
  readonly channel: string;
  readonly author: string;
  readonly text: string;
  readonly ts: number;
}

export interface ChatRequest {
  readonly channel: string;
  readonly text: string;
}

export interface ChatResponse {
  readonly messages: readonly ChatMessage[];
}

export interface AgentRegistry {
  readonly agents: readonly AgentConfig[];
}
