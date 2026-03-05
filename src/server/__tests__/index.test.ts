import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import http from 'http';

vi.mock('../../core/orchestrator');

import { orchestrate } from '../../core/orchestrator';
import { startServer, stopServer, isServerRunning } from '../index';

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
