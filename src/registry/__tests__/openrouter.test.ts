import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OpenRouterModel } from '../openrouter';

vi.mock('axios');
vi.mock('fs');

import axios from 'axios';
import fs from 'fs';
import {
  determineTier,
  determineProvider,
  determineCategories,
  mapToModel,
  fetchOpenRouterModels,
  clearCache,
  isCacheValid,
  readDiskCache,
  OPENROUTER_API_URL,
  DISK_CACHE_PATH,
} from '../openrouter';

const mockedAxios = vi.mocked(axios);
const mockedFs = vi.mocked(fs);

function makeOrModel(overrides: Partial<OpenRouterModel> = {}): OpenRouterModel {
  return {
    id: 'anthropic/claude-haiku',
    canonical_slug: 'anthropic/claude-haiku-20241022',
    name: 'Claude Haiku',
    description: 'Fast and affordable model for simple code and documentation tasks.',
    created: 1700000000,
    context_length: 200000,
    architecture: {
      modality: 'text->text',
      input_modalities: ['text'],
      output_modalities: ['text'],
      tokenizer: 'Claude',
      instruct_type: 'anthropic',
    },
    pricing: {
      prompt: '0.00000008',
      completion: '0.00000025',
    },
    top_provider: {
      context_length: 200000,
      max_completion_tokens: 4096,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ['max_tokens', 'temperature', 'top_p'],
    ...overrides,
  };
}

describe('determineTier', () => {
  it('returns free for 0 price', () => {
    expect(determineTier(0)).toBe('free');
  });

  it('returns cheap for < $1/1M tokens', () => {
    expect(determineTier(0.0000001)).toBe('cheap');
    expect(determineTier(0.0000009)).toBe('cheap');
  });

  it('returns balanced for $1–$15/1M tokens', () => {
    expect(determineTier(0.000003)).toBe('balanced');
    expect(determineTier(0.00001)).toBe('balanced');
  });

  it('returns premium for >= $15/1M tokens', () => {
    expect(determineTier(0.000015)).toBe('premium');
    expect(determineTier(0.00002)).toBe('premium');
  });
});

describe('determineProvider', () => {
  it('maps openai prefix', () => {
    expect(determineProvider('openai/gpt-4o')).toBe('openai');
  });

  it('maps anthropic prefix', () => {
    expect(determineProvider('anthropic/claude-sonnet')).toBe('anthropic');
  });

  it('maps google prefix', () => {
    expect(determineProvider('google/gemini-pro')).toBe('google');
  });

  it('maps google-beta prefix', () => {
    expect(determineProvider('google-beta/gemini-flash')).toBe('google');
  });

  it('falls back to openrouter for unknown prefix', () => {
    expect(determineProvider('mistralai/mistral-7b')).toBe('openrouter');
    expect(determineProvider('meta-llama/llama-3')).toBe('openrouter');
  });
});

describe('determineCategories', () => {
  it('detects code categories', () => {
    const m = makeOrModel({ name: 'Coding Model', description: 'Best for coding and swe-bench tasks.' });
    const cats = determineCategories(m);
    expect(cats).toContain('code');
    expect(cats).toContain('complex-code');
  });

  it('detects research/reasoning categories', () => {
    const m = makeOrModel({ name: 'Reasoning Model', description: 'Strong reasoning and research capabilities.' });
    const cats = determineCategories(m);
    expect(cats).toContain('research');
    expect(cats).toContain('reasoning');
  });

  it('detects flash/lite/mini as lightweight categories', () => {
    const m = makeOrModel({ name: 'Gemini Flash', description: 'Fast and efficient model.' });
    const cats = determineCategories(m);
    expect(cats).toContain('simple-code');
    expect(cats).toContain('documentation');
    expect(cats).toContain('tests');
  });

  it('detects vision/multimodal categories', () => {
    const m = makeOrModel({ name: 'Vision Model', description: 'Supports multimodal image input.' });
    const cats = determineCategories(m);
    expect(cats).toContain('analysis');
  });

  it('detects documentation keywords', () => {
    const m = makeOrModel({ name: 'Doc Writer', description: 'Write readme and documentation.' });
    const cats = determineCategories(m);
    expect(cats).toContain('documentation');
  });

  it('detects architecture keywords', () => {
    const m = makeOrModel({ name: 'Architect', description: 'Design complex system architectures.' });
    const cats = determineCategories(m);
    expect(cats).toContain('architecture');
  });

  it('falls back to code+research for unknown model', () => {
    const m = makeOrModel({ name: 'XYZ-9000', description: 'A general purpose model.' });
    const cats = determineCategories(m);
    expect(cats).toContain('code');
    expect(cats).toContain('research');
  });

  it('returns unique categories (no duplicates)', () => {
    const m = makeOrModel({ name: 'Fast Flash Mini Code', description: 'Fast code model.' });
    const cats = determineCategories(m);
    expect(new Set(cats).size).toBe(cats.length);
  });
});

describe('mapToModel', () => {
  it('maps id, name, context_length', () => {
    const m = mapToModel(makeOrModel());
    expect(m.id).toBe('anthropic/claude-haiku');
    expect(m.name).toBe('Claude Haiku');
    expect(m.contextWindow).toBe(200000);
  });

  it('converts per-token pricing to per-1k', () => {
    const m = mapToModel(makeOrModel({ pricing: { prompt: '0.000001', completion: '0.000005' } }));
    expect(m.costPer1kTokens.input).toBeCloseTo(0.001);
    expect(m.costPer1kTokens.output).toBeCloseTo(0.005);
  });

  it('handles zero pricing', () => {
    const m = mapToModel(makeOrModel({ pricing: { prompt: '0', completion: '0' } }));
    expect(m.costPer1kTokens.input).toBe(0);
    expect(m.costPer1kTokens.output).toBe(0);
    expect(m.tier).toBe('free');
  });

  it('handles invalid/empty pricing gracefully', () => {
    const m = mapToModel(makeOrModel({ pricing: { prompt: '', completion: 'NaN' } }));
    expect(m.costPer1kTokens.input).toBe(0);
    expect(m.costPer1kTokens.output).toBe(0);
  });

  it('sets enabled to true', () => {
    expect(mapToModel(makeOrModel()).enabled).toBe(true);
  });

  it('assigns anthropic provider for anthropic/ prefix', () => {
    expect(mapToModel(makeOrModel()).provider).toBe('anthropic');
  });

  it('assigns correct tier for balanced model', () => {
    const m = mapToModel(makeOrModel({ pricing: { prompt: '0.000003', completion: '0.000015' } }));
    expect(m.tier).toBe('balanced');
  });
});

describe('readDiskCache', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when file does not exist', () => {
    mockedFs.existsSync.mockReturnValue(false);
    expect(readDiskCache()).toBeNull();
  });

  it('returns null when cache is expired', () => {
    const expired = JSON.stringify({ timestamp: Date.now() - 2 * 60 * 60 * 1000, data: [] });
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(expired);
    expect(readDiskCache()).toBeNull();
  });

  it('returns null on JSON parse error', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('not-json');
    expect(readDiskCache()).toBeNull();
  });

  it('returns models when cache is fresh', () => {
    const model = mapToModel(makeOrModel());
    const fresh = JSON.stringify({ timestamp: Date.now(), data: [model] });
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(fresh);
    const result = readDiskCache();
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('anthropic/claude-haiku');
  });
});

describe('fetchOpenRouterModels', () => {
  const mockModel = makeOrModel();
  const mockResponse = { data: { data: [mockModel] } };

  beforeEach(() => {
    clearCache();
    vi.resetAllMocks();
    mockedFs.existsSync.mockReturnValue(false); // no disk cache by default
    vi.mocked(axios.get).mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  it('fetches models from the correct URL', async () => {
    await fetchOpenRouterModels('test-key');
    expect(axios.get).toHaveBeenCalledWith(
      OPENROUTER_API_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  it('returns mapped models', async () => {
    const models = await fetchOpenRouterModels('key');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('anthropic/claude-haiku');
  });

  it('caches results and returns cache on second call', async () => {
    await fetchOpenRouterModels('key');
    await fetchOpenRouterModels('key');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('uses disk cache when available and skips API', async () => {
    const model = mapToModel(makeOrModel());
    const fresh = JSON.stringify({ timestamp: Date.now(), data: [model] });
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(fresh);

    const models = await fetchOpenRouterModels();
    expect(axios.get).not.toHaveBeenCalled();
    expect(models).toHaveLength(1);
  });

  it('writes to disk cache after API fetch', async () => {
    await fetchOpenRouterModels('key');
    expect(mockedFs.mkdirSync).toHaveBeenCalled();
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      DISK_CACHE_PATH,
      expect.stringContaining('anthropic/claude-haiku')
    );
  });

  it('does not throw if disk write fails', async () => {
    mockedFs.mkdirSync.mockImplementation(() => { throw new Error('disk full'); });
    await expect(fetchOpenRouterModels('key')).resolves.toHaveLength(1);
  });

  it('uses OPENROUTER_KEY env var when no key provided', async () => {
    process.env['OPENROUTER_KEY'] = 'env-key';
    try {
      await fetchOpenRouterModels();
      expect(axios.get).toHaveBeenCalledWith(
        OPENROUTER_API_URL,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer env-key' }),
        })
      );
    } finally {
      delete process.env['OPENROUTER_KEY'];
    }
  });

  it('omits Authorization header when no key available', async () => {
    delete process.env['OPENROUTER_KEY'];
    await fetchOpenRouterModels();
    const callArgs = vi.mocked(axios.get).mock.calls[0][1] as { headers: Record<string, string> };
    expect(callArgs.headers['Authorization']).toBeUndefined();
  });

  it('propagates axios errors', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
    await expect(fetchOpenRouterModels('key')).rejects.toThrow('Network error');
  });
});

describe('clearCache / isCacheValid', () => {
  beforeEach(() => {
    clearCache();
    vi.resetAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
    vi.mocked(axios.get).mockResolvedValue({ data: { data: [makeOrModel()] } });
  });

  afterEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  it('isCacheValid returns false initially', () => {
    expect(isCacheValid()).toBe(false);
  });

  it('isCacheValid returns true after fetch', async () => {
    await fetchOpenRouterModels('key');
    expect(isCacheValid()).toBe(true);
  });

  it('clearCache invalidates the cache', async () => {
    await fetchOpenRouterModels('key');
    expect(isCacheValid()).toBe(true);
    clearCache();
    expect(isCacheValid()).toBe(false);
  });
});
