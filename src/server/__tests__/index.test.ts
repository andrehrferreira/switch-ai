import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import http from 'http';

vi.mock('../../core/orchestrator');
vi.mock('../dashboard-api', () => ({
  apiStats: vi.fn().mockReturnValue({ totalRequests: 5, successRate: 80, avgLatencyMs: 200, totalCost: 0.1, avgCostPerRequest: 0.02, requestsPerMinute: 1 }),
  apiRequests: vi.fn().mockReturnValue({ rows: [{ id: 1 }], total: 1 }),
  apiRequestsExport: vi.fn().mockReturnValue('[]'),
  apiModels: vi.fn().mockReturnValue([{ model: 'haiku' }]),
  apiBlacklist: vi.fn().mockReturnValue([]),
  apiCategories: vi.fn().mockReturnValue([]),
  apiActivity: vi.fn().mockReturnValue([]),
  apiBackends: vi.fn().mockResolvedValue([{ name: 'Claude CLI', id: 'claude-cli', available: true }]),
}));
vi.mock('../dashboard-html', () => ({
  getDashboardHtml: vi.fn().mockReturnValue('<html>Dashboard</html>'),
}));
vi.mock('../../core/backend-preference', () => ({
  getForcedBackend: vi.fn().mockReturnValue('auto'),
  setForcedBackend: vi.fn(),
}));

import { orchestrate } from '../../core/orchestrator';
import { startServer, stopServer, isServerRunning } from '../index';
import { apiStats, apiRequests, apiRequestsExport, apiModels, apiBlacklist, apiCategories, apiActivity, apiBackends } from '../dashboard-api';
import { getForcedBackend, setForcedBackend } from '../../core/backend-preference';

function occupyPort(port: number): Promise<http.Server> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(port, 'localhost', () => resolve(srv));
  });
}

function releasePort(srv: http.Server): Promise<void> {
  return new Promise((resolve) => srv.close(() => resolve()));
}

function makeRequest(
  port: number,
  path: string,
  method: string,
  body?: object
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, data }));
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getServerPort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(0, 'localhost', () => {
      const addr = srv.address() as { port: number };
      const p = addr.port;
      srv.close(() => resolve(p));
    });
  });
}

describe('server error handling', () => {
  afterEach(async () => {
    if (isServerRunning()) {
      await stopServer();
    }
  });

  it('rejects when port is already in use', async () => {
    const port = await getServerPort();
    const occupier = await occupyPort(port);
    try {
      await expect(startServer(port)).rejects.toThrow();
      await expect(stopServer()).rejects.toThrow();
    } finally {
      await releasePort(occupier);
    }
  });
});

describe('server lifecycle', () => {
  beforeEach(async () => {
    if (isServerRunning()) {
      await stopServer();
    }
  });

  afterEach(async () => {
    if (isServerRunning()) {
      await stopServer();
    }
  });

  it('starts and reports running', async () => {
    expect(isServerRunning()).toBe(false);
    await startServer(0);
    expect(isServerRunning()).toBe(true);
  });

  it('stops server correctly', async () => {
    await startServer(0);
    expect(isServerRunning()).toBe(true);
    await stopServer();
    expect(isServerRunning()).toBe(false);
  });

  it('stopServer resolves when server is not running', async () => {
    await expect(stopServer()).resolves.toBeUndefined();
  });

  it('reports not running initially', () => {
    expect(isServerRunning()).toBe(false);
  });
});

describe('server HTTP handling', () => {
  let port: number;

  beforeEach(async () => {
    if (isServerRunning()) {
      await stopServer();
    }
    vi.mocked(orchestrate).mockResolvedValue({
      response: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-haiku',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 5, output_tokens: 10 },
      },
      selectedModel: 'claude-haiku',
      backend: 'openrouter',
      attempts: 1,
    });
    port = await getServerPort();
    await startServer(port);
  });

  afterEach(async () => {
    if (isServerRunning()) {
      await stopServer();
    }
  });

  it('handles valid POST /v1/messages', async () => {
    const result = await makeRequest(port, '/v1/messages', 'POST', {
      model: 'claude-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    });
    expect(result.statusCode).toBe(200);
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveProperty('id');
    expect(parsed.type).toBe('message');
  });

  it('handles invalid endpoint', async () => {
    const result = await makeRequest(port, '/v1/invalid', 'POST', {
      model: 'claude-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    });
    expect(result.statusCode).toBe(404);
  });

  it('handles empty body gracefully', async () => {
    const result = await makeRequest(port, '/v1/messages', 'POST');
    // Empty body should return 400 (validation error)
    expect(result.statusCode).toBe(400);
  });

  it('handles GET request to /v1/messages', async () => {
    const result = await makeRequest(port, '/v1/messages', 'GET');
    // GET to POST-only endpoint should return 404 or 400
    expect([400, 404]).toContain(result.statusCode);
  });

  it('handles request with invalid JSON body', async () => {
    const raw = new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      const body = 'not-valid-json';
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, data }));
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    const result = await raw;
    expect([200, 500]).toContain(result.statusCode);
  });
});

describe('dashboard routes', () => {
  let port: number;

  beforeEach(async () => {
    if (isServerRunning()) await stopServer();
    vi.mocked(orchestrate).mockResolvedValue({
      response: {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-haiku',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 5, output_tokens: 10 },
      },
      selectedModel: 'claude-haiku',
      backend: 'openrouter',
      attempts: 1,
    });
    port = await getServerPort();
    await startServer(port);
  });

  afterEach(async () => {
    if (isServerRunning()) await stopServer();
  });

  it('serves dashboard HTML at /', async () => {
    const result = await makeRequest(port, '/', 'GET');
    expect(result.statusCode).toBe(200);
    expect(result.data).toContain('Dashboard');
  });

  it('serves dashboard HTML at /dashboard', async () => {
    const result = await makeRequest(port, '/dashboard', 'GET');
    expect(result.statusCode).toBe(200);
    expect(result.data).toContain('Dashboard');
  });

  it('GET /api/stats returns stats JSON', async () => {
    const result = await makeRequest(port, '/api/stats', 'GET');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data.totalRequests).toBe(5);
  });

  it('GET /api/requests returns requests list', async () => {
    const result = await makeRequest(port, '/api/requests?limit=10&offset=0', 'GET');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data.rows).toHaveLength(1);
  });

  it('GET /api/requests/export returns export data', async () => {
    const result = await makeRequest(port, '/api/requests/export?format=json', 'GET');
    expect(result.statusCode).toBe(200);
    expect(result.data).toBe('[]');
  });

  it('GET /api/requests/export as CSV returns CSV content type', async () => {
    vi.mocked(apiRequestsExport).mockReturnValue('id,model\n1,haiku');
    const result = await makeRequest(port, '/api/requests/export?format=csv', 'GET');
    expect(result.statusCode).toBe(200);
  });

  it('GET /api/models returns model list', async () => {
    const result = await makeRequest(port, '/api/models', 'GET');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data).toEqual([{ model: 'haiku' }]);
  });

  it('GET /api/blacklist returns blacklist', async () => {
    const result = await makeRequest(port, '/api/blacklist', 'GET');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.data)).toEqual([]);
  });

  it('GET /api/categories returns categories', async () => {
    const result = await makeRequest(port, '/api/categories', 'GET');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.data)).toEqual([]);
  });

  it('GET /api/activity returns activity', async () => {
    const result = await makeRequest(port, '/api/activity', 'GET');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.data)).toEqual([]);
  });

  it('GET /api/backends returns backends', async () => {
    const result = await makeRequest(port, '/api/backends', 'GET');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data[0].id).toBe('claude-cli');
  });

  it('GET /api/unknown returns 404', async () => {
    const result = await makeRequest(port, '/api/unknown', 'GET');
    expect(result.statusCode).toBe(404);
  });
});

describe('debug API', () => {
  let port: number;

  beforeEach(async () => {
    if (isServerRunning()) await stopServer();
    port = await getServerPort();
    await startServer(port);
  });

  afterEach(async () => {
    if (isServerRunning()) await stopServer();
  });

  it('GET /api/debug returns current log level', async () => {
    const result = await makeRequest(port, '/api/debug', 'GET');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data).toHaveProperty('level');
  });

  it('POST /api/debug toggles log level', async () => {
    const result = await makeRequest(port, '/api/debug', 'POST');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(['debug', 'info']).toContain(data.level);
  });
});

describe('backend API', () => {
  let port: number;

  beforeEach(async () => {
    if (isServerRunning()) await stopServer();
    port = await getServerPort();
    await startServer(port);
  });

  afterEach(async () => {
    if (isServerRunning()) await stopServer();
  });

  it('GET /api/backend returns current backend and options', async () => {
    const result = await makeRequest(port, '/api/backend', 'GET');
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data.backend).toBe('auto');
    expect(data.options).toContain('auto');
  });

  it('POST /api/backend sets valid backend', async () => {
    const result = await makeRequest(port, '/api/backend', 'POST', { backend: 'claude-cli' });
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data.backend).toBe('claude-cli');
    expect(setForcedBackend).toHaveBeenCalledWith('claude-cli');
  });

  it('POST /api/backend rejects invalid backend', async () => {
    const result = await makeRequest(port, '/api/backend', 'POST', { backend: 'invalid-backend' });
    expect(result.statusCode).toBe(400);
    const data = JSON.parse(result.data);
    expect(data.error).toContain('Invalid backend');
  });
});

describe('count_tokens endpoint', () => {
  let port: number;

  beforeEach(async () => {
    if (isServerRunning()) await stopServer();
    port = await getServerPort();
    await startServer(port);
  });

  afterEach(async () => {
    if (isServerRunning()) await stopServer();
  });

  it('POST /v1/messages/count_tokens returns mock token count', async () => {
    const result = await makeRequest(port, '/v1/messages/count_tokens', 'POST', {
      model: 'claude-haiku',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.data);
    expect(data).toEqual({ input_tokens: 0 });
  });
});

describe('SSE streaming', () => {
  let port: number;

  beforeEach(async () => {
    if (isServerRunning()) await stopServer();
    vi.mocked(orchestrate).mockResolvedValue({
      response: {
        id: 'msg_sse',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Streamed response' }],
        model: 'claude-haiku',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
      },
      selectedModel: 'claude-haiku',
      backend: 'openrouter',
      attempts: 1,
    });
    port = await getServerPort();
    await startServer(port);
  });

  afterEach(async () => {
    if (isServerRunning()) await stopServer();
  });

  it('returns SSE events for stream=true', async () => {
    const result = await new Promise<{ statusCode: number; data: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const body = JSON.stringify({
        model: 'claude-haiku',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        stream: true,
      });
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, data, headers: res.headers }));
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toBe('text/event-stream');
    expect(result.data).toContain('event: message_start');
    expect(result.data).toContain('event: content_block_start');
    expect(result.data).toContain('event: content_block_delta');
    expect(result.data).toContain('event: content_block_stop');
    expect(result.data).toContain('event: message_delta');
    expect(result.data).toContain('event: message_stop');
    expect(result.data).toContain('Streamed response');
  });

  it('streams tool_use blocks correctly', async () => {
    vi.mocked(orchestrate).mockResolvedValue({
      response: {
        id: 'msg_tools',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Using tool' },
          { type: 'tool_use', id: 'toolu_123', name: 'read_file', input: { path: '/test.ts' } },
        ],
        model: 'claude-haiku',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 30 },
      },
      selectedModel: 'claude-haiku',
      backend: 'openrouter',
      attempts: 1,
    });

    const result = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      const body = JSON.stringify({
        model: 'claude-haiku',
        messages: [{ role: 'user', content: 'Read file' }],
        max_tokens: 100,
        stream: true,
      });
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, data }));
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    expect(result.statusCode).toBe(200);
    expect(result.data).toContain('tool_use');
    expect(result.data).toContain('read_file');
    expect(result.data).toContain('input_json_delta');
  });
});
