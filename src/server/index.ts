import http from 'http';
import logger from '../utils/logger';
import { handleRequest } from './handler';
import { ValidationError } from '../utils/errors';
import { getDashboardHtml } from './dashboard-html';
import { apiStats, apiRequests, apiRequestsExport, apiModels, apiBlacklist, apiCategories, apiActivity, apiBackends } from './dashboard-api';
import { getForcedBackend, setForcedBackend, type ForcedBackend } from '../core/backend-preference';
import type { RequestContext } from './types';

let server: http.Server | null = null;

export async function startServer(port: number, host: string = 'localhost'): Promise<void> {
  // Mark process as a proxy server so CLI backends are skipped (prevents recursive claude→proxy→claude loops)
  process.env['SWITCH_AI_SERVER'] = '1';

  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      try {
        // Read request body
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            const method = req.method /* v8 ignore next */ || 'GET';
            const rawUrl = req.url /* v8 ignore next */ || '/';
            const path = rawUrl.split('?')[0];

            // Dashboard UI
            if (method === 'GET' && (path === '/dashboard' || path === '/')) {
              const html = getDashboardHtml();
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(html);
              return;
            }

            // Debug toggle API
            if (path === '/api/debug') {
              if (method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ level: logger.getLevel() }));
                return;
              }
              if (method === 'POST') {
                const current = logger.getLevel();
                const newLevel = current === 'debug' ? 'info' : 'debug';
                logger.setLevel(newLevel);
                logger.info(`Log level changed to ${newLevel}`);
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ level: newLevel }));
                return;
              }
            }

            // Backend preference API
            if (path === '/api/backend') {
              const validBackends: ForcedBackend[] = ['auto', 'claude-cli', 'gemini-cli', 'cursor-cli', 'gemini-api', 'openrouter'];
              if (method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ backend: getForcedBackend(), options: validBackends }));
                return;
              }
              if (method === 'POST') {
                const requested = (parsedBody as { backend?: string }).backend;
                if (requested && validBackends.includes(requested as ForcedBackend)) {
                  setForcedBackend(requested as ForcedBackend);
                  logger.info(`Backend forced to: ${requested}`);
                  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ backend: requested }));
                } else {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: `Invalid backend. Options: ${validBackends.join(', ')}` }));
                }
                return;
              }
            }

            // Dashboard API endpoints
            if (method === 'GET' && path.startsWith('/api/')) {
              const qs = new URLSearchParams(rawUrl.split('?')[1] ?? '');
              let data: unknown;

              if (path === '/api/stats') {
                data = apiStats();
              } else if (path === '/api/requests') {
                data = apiRequests({
                  limit: Number(qs.get('limit') ?? 20),
                  offset: Number(qs.get('offset') ?? 0),
                  model: qs.get('model') ?? undefined,
                  status: qs.get('status') ?? undefined,
                  from: qs.get('from') ?? undefined,
                  to: qs.get('to') ?? undefined,
                  search: qs.get('search') ?? undefined,
                });
              } else if (path === '/api/requests/export') {
                const format = (qs.get('format') ?? 'json') as 'json' | 'csv';
                const content = apiRequestsExport({
                  model: qs.get('model') ?? undefined,
                  status: qs.get('status') ?? undefined,
                  from: qs.get('from') ?? undefined,
                  to: qs.get('to') ?? undefined,
                }, format);
                const contentType = format === 'csv' ? 'text/csv' : 'application/json';
                const ext = format === 'csv' ? 'csv' : 'json';
                res.writeHead(200, {
                  'Content-Type': contentType,
                  'Content-Disposition': `attachment; filename="requests.${ext}"`,
                  'Access-Control-Allow-Origin': '*',
                });
                res.end(content);
                return;
              } else if (path === '/api/models') {
                data = apiModels();
              } else if (path === '/api/blacklist') {
                data = apiBlacklist();
              } else if (path === '/api/categories') {
                data = apiCategories();
              } else if (path === '/api/activity') {
                data = apiActivity();
              } else if (path === '/api/backends') {
                data = await apiBackends();
              } else {
                res.writeHead(404); res.end('{}'); return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify(data));
              return;
            }

            // count_tokens: Claude Code uses this for context management.
            // Return a mock so it doesn't retry endlessly.
            if (method === 'POST' && path === '/v1/messages/count_tokens') {
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ input_tokens: 0 }));
              return;
            }

            // Reject anything that's not POST /v1/messages
            if (method !== 'POST' || path !== '/v1/messages') {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: { type: 'not_found', message: 'Endpoint not found' } }));
              return;
            }

            const ctx: RequestContext = {
              method,
              url: rawUrl,
              headers: req.headers as Record<string, string | string[] | undefined>,
              body,
              parsedBody,
            };

            // Handle request
            const response = await handleRequest(ctx);
            logger.debug('Response ready', {
              model: response.model,
              contentBlocks: response.content.length,
              stopReason: response.stop_reason,
              stream: parsedBody.stream === true,
              firstBlockType: response.content[0]?.type,
              firstBlockLength: response.content[0]?.type === 'text' ? (response.content[0] as { text: string }).text.length : 0,
            });

            // Streaming requested — emit as SSE then close
            if (parsedBody.stream === true) {
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
              });
              const sendEvent = (type: string, data: unknown) => {
                res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
              };
              sendEvent('message_start', {
                type: 'message_start',
                message: { ...response, content: [], stop_reason: null, usage: { input_tokens: response.usage.input_tokens, output_tokens: 0 } },
              });
              sendEvent('ping', { type: 'ping' });
              // Emit each content block
              response.content.forEach((block, index) => {
                if (block.type === 'text') {
                  const b = block as { type: 'text'; text: string };
                  sendEvent('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
                  sendEvent('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: b.text } });
                  sendEvent('content_block_stop', { type: 'content_block_stop', index });
                } else if (block.type === 'tool_use') {
                  const b = block as { type: 'tool_use'; id: string; name: string; input: unknown };
                  sendEvent('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
                  sendEvent('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
                  sendEvent('content_block_stop', { type: 'content_block_stop', index });
                }
              });
              sendEvent('message_delta', { type: 'message_delta', delta: { stop_reason: response.stop_reason ?? 'end_turn', stop_sequence: null }, usage: { output_tokens: response.usage.output_tokens } });
              sendEvent('message_stop', { type: 'message_stop' });
              res.end();
              logger.debug('SSE stream completed');
              return;
            }

            // Non-streaming JSON response
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify(response));
          } catch (error) {
            const isValidation = error instanceof ValidationError;
            const statusCode = isValidation ? 400 : 500;
            const errorMessage = error instanceof Error ? error.message : /* v8 ignore next */ String(error);
            if (!isValidation) {
              logger.error('Error handling request', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
              });
            }
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: {
                  type: isValidation ? 'invalid_request_error' : 'internal_server_error',
                  message: isValidation
                    ? (error as ValidationError).message
                    : `Internal server error: ${errorMessage}`,
                },
              })
            );
          }
        });
      /* v8 ignore next 7 */
      } catch (error) {
        logger.error('Fatal request handler error', {
          error: error instanceof Error ? error.message : String(error),
        });
        res.writeHead(500);
        res.end();
      }
    });

    server.listen(port, host, () => {
      logger.info('Server started', {
        url: `http://${host}:${port}/v1/messages`,
        port,
        host,
      });
      resolve();
    });

    server.on('error', (error) => {
      logger.error('Server error', {
        error: error instanceof Error ? error.message : /* v8 ignore next */ String(error),
      });
      reject(error);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        logger.error('Error stopping server', {
          error: error instanceof Error ? error.message : /* v8 ignore next */ String(error),
        });
        reject(error);
      } else {
        server = null;
        logger.info('Server stopped');
        resolve();
      }
    });
  });
}

export function isServerRunning(): boolean {
  return server !== null && server.listening;
}
