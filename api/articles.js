import {
  notion,
  databaseId,
  cacheSeconds,
  getDataSourceId,
  mapArticle
} from './notion.js';

export default async function handler(req, res) {
  try {
    if (!process.env.NOTION_TOKEN || !databaseId) {
      throw new Error('Missing NOTION_TOKEN or NOTION_DATABASE_ID');
    }

    const dataSourceId = await getDataSourceId();

    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
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

    res.setHeader(
      'Cache-Control',
      `s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
    );

    res.status(200).json({
      articles: response.results
        .map(mapArticle)
        .filter((article) => article.slug)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}