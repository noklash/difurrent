import { Client } from '@notionhq/client';

export const notion = new Client({ auth: process.env.NOTION_TOKEN });
export const databaseId = process.env.NOTION_DATABASE_ID;
export const cacheSeconds = Number(process.env.NOTION_CMS_CACHE_SECONDS || 120);

export function plain(arr = []) {
  return arr.map((t) => t.plain_text || '').join('');
}

export function title(propertyValue) {
  return propertyValue?.title ? plain(propertyValue.title) : '';
}

export function rich(propertyValue) {
  return propertyValue?.rich_text ? plain(propertyValue.rich_text) : '';
}

export function select(propertyValue) {
  return propertyValue?.select?.name || propertyValue?.status?.name || '';
}

export function multi(propertyValue) {
  return (propertyValue?.multi_select || []).map((item) => item.name);
}

export function date(propertyValue) {
  return propertyValue?.date?.start || '';
}

export function url(propertyValue) {
  return propertyValue?.url || '';
}

export function checkbox(propertyValue) {
  return Boolean(propertyValue?.checkbox);
}

export function fileUrl(propertyValue) {
  const file = propertyValue?.files?.[0];
  return file?.external?.url || file?.file?.url || '';
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c])
  );
}

export function richText(arr = []) {
  return arr
    .map((item) => {
      let text = escapeHtml(item.plain_text || '');

      if (item.href) {
        text = `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener">${text}</a>`;
      }
      if (item.annotations?.bold) text = `<strong>${text}</strong>`;
      if (item.annotations?.italic) text = `<em>${text}</em>`;
      if (item.annotations?.code) text = `<code>${text}</code>`;

      return text;
    })
    .join('');
}

export async function getDataSourceId() {
  const database = await notion.databases.retrieve({
    database_id: databaseId
  });

  const dataSource = database.data_sources?.[0];

  if (!dataSource?.id) {
    throw new Error('No Notion data source found for NOTION_DATABASE_ID');
  }

  return dataSource.id;
}

export function mapArticle(page) {
  const properties = page.properties;
  const slug = rich(properties.Slug);
  const topic = multi(properties.Topic);

  return {
    id: page.id,
    title: title(properties['Content / Visibility Item']),
    slug,
    excerpt: rich(properties.Excerpt),
    description:
      rich(properties.Excerpt) || rich(properties['SEO Description']),
    seoTitle: rich(properties['SEO Title']),
    seoDescription: rich(properties['SEO Description']),
    canonicalUrl:
      url(properties['Canonical URL']) ||
      (slug ? `https://difurrent.com/articles/${slug}/` : ''),
    publishedUrl: url(properties['Published URL']),
    publishDate: date(properties['Publish Date']),
    type: select(properties.Type),
    status: select(properties.Status),
    channel: multi(properties.Channel),
    topic,
    category: topic[0] || 'Technology',
    featured: checkbox(properties.Featured),
    cover: fileUrl(properties['Cover Image']),
    coverAlt: title(properties['Content / Visibility Item']),
    readingTime: properties['Reading Time']?.number || null
  };
}