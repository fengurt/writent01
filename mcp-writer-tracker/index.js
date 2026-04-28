const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3111;
const parser = new Parser();

// API Key from environment - NEVER exposed
const API_KEY = process.env.WRITER_TRACKER_API_KEY;

app.use(cors());
app.use(express.json());

// Auth middleware
const requireAuth = (req, res, next) => {
  const providedKey = req.headers['x-api-key'] || req.query.api_key;

  if (!API_KEY) {
    return res.status(500).json({
      error: 'API key not configured',
      message: 'Set WRITER_TRACKER_API_KEY environment variable'
    });
  }

  if (providedKey !== API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }

  next();
};

// Writers database (same as main server)
const writers = [
  { id: 'naval-ravikant', name: 'Naval Ravikant', website: 'https://nav.al', feedUrl: 'https://nav.al/feed' },
  { id: 'shane-parrish', name: 'Shane Parrish', website: 'https://fs.blog', feedUrl: 'https://fs.blog/feed' },
  { id: 'adam-grant', name: 'Adam Grant', website: 'https://adamgrant.net', feedUrl: 'https://adamgrant.net/feed' },
  { id: 'morgan-housel', name: 'Morgan Housel', website: 'https://collabfund.com/blog', feedUrl: 'https://collabfund.com/blog/feed' },
  { id: 'james-clear', name: 'James Clear', website: 'https://jamesclear.com', feedUrl: 'https://jamesclear.com/feed' },
  { id: 'ryan-holiday', name: 'Ryan Holiday', website: 'https://ryanholiday.net', feedUrl: 'https://ryanholiday.net/feed' },
  { id: 'brene-brown', name: 'Brené Brown', website: 'https://brenebrown.com', feedUrl: 'https://brenebrown.com/feed' },
  { id: 'seth-godin', name: 'Seth Godin', website: 'https://sethgodin.com', feedUrl: 'https://seths.blog/feed' },
  { id: 'ben-thompson', name: 'Ben Thompson', website: 'https://stratechery.com', feedUrl: 'https://stratechery.com/feed' },
  { id: 'lenny-rachitsky', name: 'Lenny Rachitsky', website: 'https://lennysnewsletter.com', feedUrl: 'https://lennysnewsletter.com/feed' },
  { id: 'noah-smith', name: 'Noah Smith', website: 'https://noahpinion.substack.com', feedUrl: 'https://noahpinion.substack.com/feed' },
  { id: 'azeem-azhar', name: 'Azeem Azhar', website: 'https://exponentialview.co', feedUrl: 'https://exponentialview.co/feed' },
  { id: 'gergely-orosz', name: 'Gergely Orosz', website: 'https://pragmaticengineer.com', feedUrl: 'https://newsletter.pragmaticengineer.com/feed' },
  { id: 'david-perell', name: 'David Perell', website: 'https://perell.com', feedUrl: 'https://perell.com/rss' },
  { id: 'julian-shapiro', name: 'Julian Shapiro', website: 'https://www.julian.com', feedUrl: 'https://www.julian.com/feed' },
  { id: 'tim-denning', name: 'Tim Denning', website: 'https://timdenning.com', feedUrl: 'https://timdenning.com/feed' },
  { id: 'justin-welsh', name: 'Justin Welsh', website: 'https://justinwelsh.me', feedUrl: 'https://justinwelsh.me/feed' },
  { id: 'sahil-bloom', name: 'Sahil Bloom', website: 'https://sahilbloom.com', feedUrl: 'https://sahilbloom.com/feed' }
];

const updateHistory = {};
writers.forEach(w => { updateHistory[w.id] = []; });

// MCP Tool Handlers
const tools = {
  'list-writers': {
    description: 'List all available writers / 列出所有作家',
    parameters: { type: 'object', properties: {} },
    handler: async () => ({ writers })
  },

  'check-updates': {
    description: 'Check latest article updates / 检查最新文章更新',
    parameters: {
      type: 'object',
      properties: { writerId: { type: 'string', description: 'Writer ID' } },
      required: ['writerId']
    },
    handler: async (params) => {
      const writer = writers.find(w => w.id === params.writerId);
      if (!writer) throw new Error(`Writer not found: ${params.writerId}`);

      try {
        const feed = await parser.parseURL(writer.feedUrl);
        const latestItem = feed.items[0];
        const update = {
          title: latestItem.title,
          url: latestItem.link,
          date: latestItem.pubDate,
          checkedAt: new Date().toISOString()
        };
        updateHistory[writer.id].unshift(update);
        updateHistory[writer.id] = updateHistory[writer.id].slice(0, 50);
        return { writer: writer.name, latestUpdate: update, history: updateHistory[writer.id].slice(0, 10) };
      } catch (error) {
        return { writer: writer.name, error: error.message };
      }
    }
  },

  'get-history': {
    description: 'Get update history / 获取更新历史',
    parameters: {
      type: 'object',
      properties: { writerId: { type: 'string' }, limit: { type: 'number', default: 10 } },
      required: ['writerId']
    },
    handler: async (params) => ({
      writerId: params.writerId,
      history: updateHistory[params.writerId]?.slice(0, params.limit || 10) || [],
      total: updateHistory[params.writerId]?.length || 0
    })
  },

  'search-writers': {
    description: 'Search for writers / 搜索作家',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query']
    },
    handler: async (params) => {
      const q = params.query.toLowerCase();
      const results = writers.filter(w =>
        w.name.toLowerCase().includes(q) || w.website.toLowerCase().includes(q)
      );
      return { results, count: results.length };
    }
  },

  'get-all-updates': {
    description: 'Check updates from all writers / 检查所有作家更新',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const results = [];
      for (const writer of writers) {
        try {
          const feed = await parser.parseURL(writer.feedUrl);
          if (feed.items[0]) {
            const update = {
              writer: writer.name,
              writerId: writer.id,
              title: feed.items[0].title,
              url: feed.items[0].link,
              date: feed.items[0].pubDate
            };
            results.push(update);
            updateHistory[writer.id].unshift({ ...update, checkedAt: new Date().toISOString() });
          }
        } catch (e) {
          results.push({ writer: writer.name, writerId: writer.id, error: e.message });
        }
      }
      return { updates: results, checkedAt: new Date().toISOString() };
    }
  },

  // Protected write operations
  'add-writer': {
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
    handler: async (params) => {
      if (params.apiKey !== API_KEY) {
        return { error: 'Unauthorized', message: 'Invalid API key' };
      }
      if (writers.find(w => w.id === params.id)) {
        return { error: 'Writer already exists' };
      }
      writers.push({
        id: params.id,
        name: params.name,
        website: params.website,
        feedUrl: params.feedUrl || `${params.website}/feed`
      });
      updateHistory[params.id] = [];
      return { success: true, writer: writers.find(w => w.id === params.id) };
    }
  },

  'update-writer': {
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
    handler: async (params) => {
      if (params.apiKey !== API_KEY) {
        return { error: 'Unauthorized', message: 'Invalid API key' };
      }
      const writer = writers.find(w => w.id === params.id);
      if (!writer) return { error: 'Writer not found' };
      if (params.name) writer.name = params.name;
      if (params.website) writer.website = params.website;
      if (params.feedUrl) writer.feedUrl = params.feedUrl;
      return { success: true, writer };
    }
  },

  'delete-writer': {
    description: 'Delete a writer (requires API key) / 删除作家（需API密钥）',
    parameters: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        id: { type: 'string' }
      },
      required: ['apiKey', 'id']
    },
    handler: async (params) => {
      if (params.apiKey !== API_KEY) {
        return { error: 'Unauthorized', message: 'Invalid API key' };
      }
      const index = writers.findIndex(w => w.id === params.id);
      if (index === -1) return { error: 'Writer not found' };
      const deleted = writers.splice(index, 1)[0];
      delete updateHistory[params.id];
      return { success: true, deleted };
    }
  }
};

// MCP Protocol Routes
app.post('/mcp/tools/call', async (req, res) => {
  const { tool, parameters } = req.body;

  if (!tools[tool]) {
    return res.status(400).json({ error: `Unknown tool: ${tool}` });
  }

  try {
    const result = await tools[tool].handler(parameters || {});
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/tools', (req, res) => {
  const toolList = Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.parameters
  }));
  res.json({ tools: toolList });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!API_KEY
  });
});

app.listen(PORT, () => {
  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`  MCP Writer Tracker running on http://localhost:${PORT}`);
  console.log(`  API Key: ${API_KEY ? 'Configured ✓' : 'NOT SET'}`);
  console.log(`  Tools: ${Object.keys(tools).join(', ')}`);
  console.log(`═══════════════════════════════════════════════════════════`);
});