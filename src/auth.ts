import type { Context, Next } from 'hono';

export function authMiddleware(apiKey: string) {
  return async (c: Context, next: Next) => {
    const providedKey = c.req.header('X-API-Key') || c.req.query('api_key');

    if (!apiKey) {
      return c.json({
        error: 'API key not configured',
        message: 'Set WRITER_TRACKER_API_KEY environment variable'
      }, 500);
    }

    if (providedKey !== apiKey) {
      return c.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, 401);
    }

    await next();
  };
}
