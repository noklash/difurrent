import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;
const cacheSeconds = Number(process.env.NOTION_CMS_CACHE_SECONDS || 120);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[character]));
}

function richText(arr = []) {
  return arr.map((item) => {
    let text = escapeHtml(item.plain_text || '');

    if (item.href) {
      text = `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">${text}</a>`;
    }

    if (item.annotations?.bold) {
      text = `<strong>${text}</strong>`;
    }

    if (item.annotations?.italic) {
      text = `<em>${text}</em>`;
    }

    if (item.annotations?.code) {
      text = `<code>${text}</code>`;
    }

    return text;
  }).join('');
}

function plain(arr = []) {
  return arr.map((item) => item.plain_text || '').join('');
}

function title(propertyValue) {
  return propertyValue?.title ? plain(propertyValue.title) : '';
}

function rich(propertyValue) {
  return propertyValue?.rich_text ? plain(propertyValue.rich_text) : '';
}

function multi(propertyValue) {
  return (propertyValue?.multi_select || []).map((item) => item.name);
}

function date(propertyValue) {
  return propertyValue?.date?.start || '';
}

function url(propertyValue) {
  return propertyValue?.url || '';
}

function checkbox(propertyValue) {
  return Boolean(propertyValue?.checkbox);
}

function fileUrl(propertyValue) {
  const file = propertyValue?.files?.[0];
  return file?.external?.url || file?.file?.url || '';
}

async function children(blockId) {
  let results = [];
  let startCursor;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: startCursor
    });

    results.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return results;
}

function blockToHtml(block) {
  const type = block.type;
  const payload = block[type];

  if (!payload) {
    return '';
  }

  const text = richText(payload.rich_text || []);

  switch (type) {
    case 'paragraph':
      return text ? `<p>${text}</p>` : '';
    case 'heading_1':
      return `<h1>${text}</h1>`;
    case 'heading_2':
      return `<h2>${text}</h2>`;
    case 'heading_3':
      return `<h3>${text}</h3>`;
    case 'bulleted_list_item':
      return `<ul><li>${text}</li></ul>`;
    case 'numbered_list_item':
      return `<ol><li>${text}</li></ol>`;
    case 'quote':
      return `<blockquote>${text}</blockquote>`;
    case 'divider':
      return '<hr>';
    case 'code':
      return `<pre><code>${escapeHtml(plain(payload.rich_text || []))}</code></pre>`;
    case 'image': {
      const src = payload.external?.url || payload.file?.url || '';
      const alt = plain(payload.caption || []);

      return src
        ? `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`
        : '';
    }
    default:
      return '';
  }
}

function normalizeLists(html) {
  return html.replace(/<\/ul>\n?<ul>/g, '').replace(/<\/ol>\n?<ol>/g, '');
}

async function renderBlocks(pageId) {
  const blocks = await children(pageId);
  return normalizeLists(blocks.map(blockToHtml).filter(Boolean).join('\n'));
}

function mapMeta(page) {
  const properties = page.properties;
  const slug = rich(properties.Slug);
  const topic = multi(properties.Topic);

  return {
    id: page.id,
    title: title(properties['Content / Visibility Item']),
    slug,
    excerpt: rich(properties.Excerpt),
    description: rich(properties.Excerpt) || rich(properties['SEO Description']),
    seoTitle: rich(properties['SEO Title']),
    seoDescription: rich(properties['SEO Description']),
    canonicalUrl: url(properties['Canonical URL']) || (slug ? `https://difurrent.com/articles/${slug}/` : ''),
    publishDate: date(properties['Publish Date']),
    topic,
    category: topic[0] || 'Technology',
    featured: checkbox(properties.Featured),
    cover: fileUrl(properties['Cover Image']),
    coverAlt: title(properties['Content / Visibility Item']),
    readingTime: properties['Reading Time']?.number || null
  };
}

export default async function handler(req, res) {
  try {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({ error: 'Missing slug' });
    }

    if (!process.env.NOTION_TOKEN || !databaseId) {
      throw new Error('Missing NOTION_TOKEN or NOTION_DATABASE_ID');
    }

    const query = await notion.databases.query({
      database_id: databaseId,
      page_size: 1,
      filter: {
        and: [
          { property: 'Slug', rich_text: { equals: slug } },
          { property: 'Type', select: { equals: 'Website Article' } },
          { property: 'Status', status: { equals: 'Published' } },
          { property: 'Publish to Website', checkbox: { equals: true } }
        ]
      }
    });

    const page = query.results[0];

    if (!page) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const html = await renderBlocks(page.id);

    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
    res.status(200).json({
      ...mapMeta(page),
      html
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

