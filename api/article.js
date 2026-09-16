import {
  notion,
  databaseId,
  cacheSeconds,
  getDataSourceId,
  mapArticle,
  richText,
  plain,
  escapeHtml
} from './notion.js';

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

  if (!payload) return '';

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
  return html
    .replace(/<\/ul>\n?<ul>/g, '')
    .replace(/<\/ol>\n?<ol>/g, '');
}

async function renderBlocks(pageId) {
  const blocks = await children(pageId);
  return normalizeLists(
    blocks.map(blockToHtml).filter(Boolean).join('\n')
  );
}

export default async function handler(req, res) {
  try {
    const slug = req.query?.slug;

    if (!slug) {
      return res.status(400).json({ error: 'Missing slug' });
    }

    if (!process.env.NOTION_TOKEN || !databaseId) {
      throw new Error('Missing NOTION_TOKEN or NOTION_DATABASE_ID');
    }

    const dataSourceId = await getDataSourceId();

    const query = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 1,
      filter: {
        and: [
          { property: 'Slug', rich_text: { equals: slug } },
          { property: 'Type', select: { equals: 'Website Article' } },
          { property: 'Status', status: { equals: 'Published' } },
          { property: 'Publish to Website', checkbox: { equals: true } },
          { property: 'Channel', multi_select: { contains: 'difurrent.com' } }
        ]
      }
    });

    const page = query.results[0];

    if (!page) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const html = await renderBlocks(page.id);

    res.setHeader(
      'Cache-Control',
      `s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
    );

    res.status(200).json({
      ...mapArticle(page),
      html
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}