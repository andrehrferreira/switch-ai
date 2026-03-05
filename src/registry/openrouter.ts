import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import type { Model, ModelTier, ModelProvider } from './model-registry';

export const DISK_CACHE_PATH = path.join(os.homedir(), '.switch-ai', 'models.json');

// ─── OpenRouter API types ────────────────────────────────────────────────────

export interface OpenRouterPricing {
  prompt: string;           // per-token price as decimal string
  completion: string;       // per-token price as decimal string
  image?: string;
  request?: string;
  input_cache_read?: string;
  input_cache_write?: string;
  web_search?: string;
}

export interface OpenRouterArchitecture {
  modality: string;                  // e.g. "text+image->text"
  input_modalities: string[];        // ["text", "image", "file"]
  output_modalities: string[];       // ["text"]
  tokenizer: string;
  instruct_type: string | null;
}

export interface OpenRouterTopProvider {
  context_length: number;
  max_completion_tokens: number | null;
  is_moderated: boolean;
}

export interface OpenRouterModel {
  id: string;
  canonical_slug?: string;
  name: string;
  description: string;
  created: number;
  context_length: number;
  architecture: OpenRouterArchitecture;
  pricing: OpenRouterPricing;
  top_provider: OpenRouterTopProvider;
  per_request_limits: null | Record<string, string>;
  supported_parameters: string[];
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

// ─── Internal cache ──────────────────────────────────────────────────────────

interface ModelCache {
  data: Model[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/models';

let cache: ModelCache | null = null;

export function readDiskCache(): Model[] | null {
  try {
    if (!fs.existsSync(DISK_CACHE_PATH)) return null;
    const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { timestamp: number; data: Model[] };
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeDiskCache(models: Model[]): void {
  try {
    fs.mkdirSync(path.dirname(DISK_CACHE_PATH), { recursive: true });
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify({ timestamp: Date.now(), data: models }));
  } catch {
    // disk write failure is non-fatal
  }
}

// ─── Tier classification ─────────────────────────────────────────────────────

/**
 * Determine model tier based on input price per token.
 *
 * Thresholds (per token → per 1M tokens):
 *   free     = $0
 *   cheap    = $0 – $1/1M    (< 0.000001/token)
 *   balanced = $1 – $15/1M   (< 0.000015/token)
 *   premium  = $15+/1M       (≥ 0.000015/token)
 */
export function determineTier(pricePerToken: number): ModelTier {
  if (pricePerToken === 0) return 'free';
  if (pricePerToken < 0.000001) return 'cheap';
  if (pricePerToken < 0.000015) return 'balanced';
  return 'premium';
}

// ─── Provider detection ──────────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, ModelProvider> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  'google-beta': 'google',
};

export function determineProvider(modelId: string): ModelProvider {
  const prefix = modelId.split('/')[0];
  return PROVIDER_MAP[prefix] ?? 'openrouter';
}

// ─── Category detection ───────────────────────────────────────────────────────

export function determineCategories(model: OpenRouterModel): string[] {
  const text = `${model.name} ${model.description}`.toLowerCase();
  const cats = new Set<string>();

  if (text.match(/\bcode|coding|swe[-\s]bench|programming\b/)) {
    cats.add('code');
    cats.add('complex-code');
  }
  if (text.match(/\breason|think|research|analysis|analysi\b/)) {
    cats.add('research');
    cats.add('reasoning');
  }
  if (text.match(/\bflash|lite|mini|fast|quick|small\b/)) {
    cats.add('simple-code');
    cats.add('documentation');
    cats.add('tests');
  }
  if (text.match(/\bvision|multimodal|image|visual\b/)) {
    cats.add('analysis');
  }
  if (text.match(/\bdocument|readme|comment|doc\b/)) {
    cats.add('documentation');
  }
  if (text.match(/\barchitect|design|system\b/)) {
    cats.add('architecture');
  }

  // Ensure at least one category
  if (cats.size === 0) {
    cats.add('code');
    cats.add('research');
  }

  return [...cats];
}

// ─── Model mapper ─────────────────────────────────────────────────────────────

export function mapToModel(orModel: OpenRouterModel): Model {
  const inputPricePerToken = parseFloat(orModel.pricing.prompt) || 0;
  const outputPricePerToken = parseFloat(orModel.pricing.completion) || 0;

  // Negative pricing = special/routing meta-model (e.g. openrouter/bodybuilder)
  // Exclude from selection to avoid garbage responses
  const hasNegativePrice = inputPricePerToken < 0 || outputPricePerToken < 0;

  return {
    id: orModel.id,
    name: orModel.name,
    tier: determineTier(inputPricePerToken),
    provider: determineProvider(orModel.id),
    costPer1kTokens: {
      input: Math.round(inputPricePerToken * 1000 * 1e9) / 1e9,
      output: Math.round(outputPricePerToken * 1000 * 1e9) / 1e9,
    },
    contextWindow: orModel.context_length,
    categories: determineCategories(orModel),
    enabled: !hasNegativePrice,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all models available on OpenRouter, with 1-hour local cache.
 *
 * @param apiKey  Optional Bearer token (uses OPENROUTER_KEY env var if omitted)
 */
export async function fetchOpenRouterModels(apiKey?: string): Promise<Model[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  // Try disk cache before hitting the API
  const disk = readDiskCache();
  if (disk) {
    cache = { data: disk, timestamp: Date.now() };
    return disk;
  }

  const key = apiKey ?? process.env['OPENROUTER_KEY'];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/switch-ai/switch-ai',
  };

  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }

  const response = await axios.get<OpenRouterModelsResponse>(OPENROUTER_API_URL, { headers });
  const models = response.data.data.map(mapToModel);

  cache = { data: models, timestamp: Date.now() };
  writeDiskCache(models);
  return models;
}

/**
 * Invalidate the in-memory model cache (useful for tests / forced refresh).
 */
export function clearCache(): void {
  cache = null;
}

/**
 * Check whether the cache is currently valid.
 */
export function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS;
}
