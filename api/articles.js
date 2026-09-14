import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;
const cacheSeconds = Number(process.env.NOTION_CMS_CACHE_SECONDS || 120);

function plain(arr = []) {
  return arr.map((t) => t.plain_text || '').join('');
}

function title(propertyValue) {
  return propertyValue?.title ? plain(propertyValue.title) : '';
}

function rich(propertyValue) {
  return propertyValue?.rich_text ? plain(propertyValue.rich_text) : '';
}

function select(propertyValue) {
  return propertyValue?.select?.name || propertyValue?.status?.name || '';
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

function mapArticle(page) {
  const properties = page.properties;
  const slug = rich(properties.Slug);

  return {
    id: page.id,
    title: title(properties['Content / Visibility Item']),
    slug,
    excerpt: rich(properties.Excerpt),
    description: rich(properties.Excerpt) || rich(properties['SEO Description']),
    seoTitle: rich(properties['SEO Title']),
    seoDescription: rich(properties['SEO Description']),
    canonicalUrl: url(properties['Canonical URL']) || (slug ? `https://difurrent.com/articles/${slug}/` : ''),
    publishedUrl: url(properties['Published URL']),
    publishDate: date(properties['Publish Date']),
    type: select(properties.Type),
    status: select(properties.Status),
    channel: multi(properties.Channel),
    topic: multi(properties.Topic),
    category: multi(properties.Topic)[0] || 'Technology',
    featured: checkbox(properties.Featured),
    cover: fileUrl(properties['Cover Image']),
    coverAlt: title(properties['Content / Visibility Item']),
    readingTime: properties['Reading Time']?.number || null
  };
}

export default async function handler(req, res) {
  try {
    if (!process.env.NOTION_TOKEN || !databaseId) {
      throw new Error('Missing NOTION_TOKEN or NOTION_DATABASE_ID');
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: 'Type', select: { equals: 'Website Article' } },
          { property: 'Status', status: { equals: 'Published' } },
          { property: 'Publish to Website', checkbox: { equals: true } },
          { property: 'Channel', multi_select: { contains: 'difurrent.com' } }
        ]
      },
      sorts: [{ property: 'Publish Date', direction: 'descending' }]
    });

    res.setHeader('Cache-Control', `s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
    res.status(200).json({
      articles: response.results.map(mapArticle).filter((article) => article.slug)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
