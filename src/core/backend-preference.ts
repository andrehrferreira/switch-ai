export type ForcedBackend = 'auto' | 'claude-cli' | 'gemini-cli' | 'cursor-cli' | 'gemini-api' | 'openrouter';

let forced: ForcedBackend = 'auto';

export function getForcedBackend(): ForcedBackend {
  return forced;
}

export function setForcedBackend(backend: ForcedBackend): void {
  forced = backend;
}
