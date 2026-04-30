import type { D1Database } from '@cloudflare/workers-types';
import * as db from './db';
import { parseRSS } from './rss';

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any, d1: D1Database, apiKey: string) => Promise<any>;
}

export function getMCPTools(): Record<string, MCPTool> {
  return {
    'list-writers': {
      name: 'list-writers',
      description: 'List all available writers / 列出所有作家',
      parameters: { type: 'object', properties: {} },
      handler: async (_params, d1) => {
        const writers = await db.getAllWriters(d1);
        return { writers };
      }
    },

    'check-updates': {
      name: 'check-updates',
      description: 'Check latest article updates / 检查最新文章更新',
      parameters: {
        type: 'object',
        properties: { writerId: { type: 'string', description: 'Writer ID' } },
        required: ['writerId']
      },
      handler: async (params, d1) => {
        const writer = await db.getWriterById(d1, params.writerId);
        if (!writer) throw new Error(`Writer not found: ${params.writerId}`);

        try {
          const feed = await parseRSS(writer.feed_url || `${writer.website}/feed`);
          const latestItem = feed.items[0];
          if (!latestItem) return { writer: writer.name, error: 'No items in feed' };

          const update = {
            title: latestItem.title,
            url: latestItem.link,
            date: latestItem.pubDate,
            checkedAt: new Date().toISOString()
          };

          await db.addUpdateHistory(d1, writer.id, {
            title: latestItem.title,
            url: latestItem.link,
            date: latestItem.pubDate,
          });

          const history = await db.getUpdateHistory(d1, writer.id, 10);
          return { writer: writer.name, latestUpdate: update, history };
        } catch (e: any) {
          return { writer: writer.name, error: e.message };
        }
      }
    },

    'get-history': {
      name: 'get-history',
      description: 'Get update history / 获取更新历史',
      parameters: {
        type: 'object',
        properties: {
          writerId: { type: 'string' },
          limit: { type: 'number', default: 10 }
        },
        required: ['writerId']
      },
      handler: async (params, d1) => {
        const history = await db.getUpdateHistory(d1, params.writerId, params.limit || 10);
        return {
          writerId: params.writerId,
          history,
          total: history.length
        };
      }
    },

    'search-writers': {
      name: 'search-writers',
      description: 'Search for writers / 搜索作家',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query']
      },
      handler: async (params, d1) => {
        const results = await db.searchWriters(d1, params.query);
        return { results, count: results.length };
      }
    },

    'get-all-updates': {
      name: 'get-all-updates',
      description: 'Check updates from all writers / 检查所有作家更新',
      parameters: { type: 'object', properties: {} },
      handler: async (_params, d1) => {
        const writers = await db.getWritersByType(d1, 'modern');
        const results = [];

        for (const writer of writers) {
          try {
            const feedUrl = writer.feed_url || `${writer.website}/feed`;
            const feed = await parseRSS(feedUrl);
            if (feed.items[0]) {
              const update = {
                writer: writer.name,
                writerId: writer.id,
                title: feed.items[0].title,
                url: feed.items[0].link,
                date: feed.items[0].pubDate
              };
              results.push(update);
              await db.addUpdateHistory(d1, writer.id, {
                title: feed.items[0].title,
                url: feed.items[0].link,
                date: feed.items[0].pubDate,
              });
            }
          } catch (e: any) {
            results.push({ writer: writer.name, writerId: writer.id, error: e.message });
          }
        }

        return { updates: results, checkedAt: new Date().toISOString() };
      }
    },

    'add-writer': {
      name: 'add-writer',
      description: 'Add a new writer (requires API key) / 添加新作家（需API密钥）',
      parameters: {
        type: 'object',
        properties: {
          apiKey: { type: 'string' },
          id: { type: 'string' },
          name: { type: 'string' },
          website: { type: 'string' },
          feedUrl: { type: 'string' }
        },
        required: ['apiKey', 'id', 'name', 'website']
      },
      handler: async (params, d1, apiKey) => {
        if (params.apiKey !== apiKey || !apiKey) {
          return { error: 'Unauthorized', message: 'Invalid API key' };
        }
        const existing = await db.getWriterById(d1, params.id);
        if (existing) return { error: 'Writer already exists' };

        const writer = {
          id: params.id,
          name: params.name,
          website: params.website,
          feed_url: params.feedUrl || `${params.website}/feed`,
          type: 'modern' as const,
          identity: '',
          twitter: '',
          articles: [],
        };
        await db.createWriter(d1, writer);
        const created = await db.getWriterById(d1, params.id);
        return { success: true, writer: created };
      }
    },

    'update-writer': {
      name: 'update-writer',
      description: 'Update a writer (requires API key) / 更新作家（需API密钥）',
      parameters: {
        type: 'object',
        properties: {
          apiKey: { type: 'string' },
          id: { type: 'string' },
          name: { type: 'string' },
          website: { type: 'string' },
          feedUrl: { type: 'string' }
        },
        required: ['apiKey', 'id']
      },
      handler: async (params, d1, apiKey) => {
        if (params.apiKey !== apiKey || !apiKey) {
          return { error: 'Unauthorized', message: 'Invalid API key' };
        }
        const writer = await db.getWriterById(d1, params.id);
        if (!writer) return { error: 'Writer not found' };

        const updates: any = {};
        if (params.name) updates.name = params.name;
        if (params.website) updates.website = params.website;
        if (params.feedUrl) updates.feed_url = params.feedUrl;
        await db.updateWriter(d1, params.id, updates);
        const updated = await db.getWriterById(d1, params.id);
        return { success: true, writer: updated };
      }
    },

    'delete-writer': {
      name: 'delete-writer',
      description: 'Delete a writer (requires API key) / 删除作家（需API密钥）',
      parameters: {
        type: 'object',
        properties: {
          apiKey: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['apiKey', 'id']
      },
      handler: async (params, d1, apiKey) => {
        if (params.apiKey !== apiKey || !apiKey) {
          return { error: 'Unauthorized', message: 'Invalid API key' };
        }
        const writer = await db.getWriterById(d1, params.id);
        if (!writer) return { error: 'Writer not found' };
        await db.deleteWriter(d1, params.id);
        return { success: true, deleted: writer };
      }
    }
  };
}
