export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  content: string;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return decodeHtmlEntities(match[1].trim());
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Handle numeric entities
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractCDATA(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const match = xml.match(cdataRegex);
  if (match) return match[1].trim();

  const escapedRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const escapedMatch = xml.match(escapedRegex);
  return escapedMatch ? decodeHtmlEntities(escapedMatch[1].trim()) : '';
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WriterTracker/2.0 (Cloudflare)' },
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

export async function parseRSS(primaryUrl: string): Promise<ParsedFeed> {
  const urlsToTry = guessFeedUrls(primaryUrl);
  let lastError: Error | null = null;

  for (const feedUrl of urlsToTry) {
    try {
      const xml = await fetchFeedXml(feedUrl);
      const feed = parseFeedXml(xml);
      if (feed.items.length > 0) return feed;
    } catch (e: any) {
      lastError = e;
    }
  }

  if (lastError) throw lastError;
  return { title: '', items: [] };
}

export async function fetchFeedXml(url: string): Promise<string> {
  const resp = await fetchWithTimeout(url, 10000);

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching ${url}`);
  }

  const text = await resp.text();
  return text;
}

export function guessFeedUrls(website: string): string[] {
  const urls: string[] = [];
  const base = website.replace(/\/+$/, ''); // strip trailing slashes

  // If it's already a feed-looking URL, try it directly first
  if (base.includes('/feed') || base.includes('/rss') || base.includes('/atom')) {
    urls.push(base);
  }

  // Standard patterns
  urls.push(`${base}/feed`);
  urls.push(`${base}/rss`);
  urls.push(`${base}/atom.xml`);
  urls.push(`${base}/index.xml`);

  return urls;
}

export function parseFeedXml(xml: string): ParsedFeed {
  // Try RSS 2.0 format
  let title = extractTag(xml, 'title') || extractCDATA(xml, 'title');

  // Try Atom format
  if (!title) {
    title = extractTag(xml, 'feed') ? extractTag(xml, 'title') : '';
  }

  const items: FeedItem[] = [];

  // RSS 2.0 items
  const rssItemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = rssItemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractCDATA(itemXml, 'title') || extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      pubDate: extractTag(itemXml, 'pubDate'),
      contentSnippet: stripHtml(extractCDATA(itemXml, 'description') || extractTag(itemXml, 'description')),
      content: extractCDATA(itemXml, 'content:encoded') ||
               extractCDATA(itemXml, 'description') ||
               extractTag(itemXml, 'content:encoded') ||
               extractTag(itemXml, 'description'),
    });
  }

  // Atom format entries
  if (items.length === 0) {
    const atomEntryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = atomEntryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      items.push({
        title: extractTag(entryXml, 'title'),
        link: extractAtomLink(entryXml),
        pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated'),
        contentSnippet: stripHtml(extractTag(entryXml, 'summary') || extractTag(entryXml, 'content')),
        content: extractTag(entryXml, 'content') || extractTag(entryXml, 'summary'),
      });
    }
  }

  return { title, items };
}

function extractAtomLink(entryXml: string): string {
  // Atom links: <link rel="alternate" href="URL"/>
  const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i);
  if (linkMatch) return linkMatch[1];

  // Fallback to RSS-style <link>
  return extractTag(entryXml, 'link');
}
