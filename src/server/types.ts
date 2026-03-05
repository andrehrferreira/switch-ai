export interface RequestContext {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  parsedBody: unknown;
}

export interface ResponseContext {
  status: number;
  headers: Record<string, string | string[]>;
  body: unknown;
}

export type MiddlewareFn = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentBlock[] }
  | { type: 'image'; source: unknown }
  | ({ type: string } & Record<string, unknown>);

export interface AnthropicRequest {
  model: string;
  messages: Array<{ role: string; content: string | ContentBlock[] }>;
  max_tokens: number;
  system?: string;
  tools?: unknown[];
  tool_choice?: unknown;
  [key: string]: unknown;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
  timestamp?: string;
}
