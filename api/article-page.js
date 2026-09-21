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
    const response =
      await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: startCursor
      });

    results.push(...response.results);

    startCursor = response.has_more
      ? response.next_cursor
      : undefined;
  } while (startCursor);

  return results;
}

function blockToHtml(block) {
  const type = block.type;
  const payload = block[type];

  if (!payload) {
    return '';
  }

  const text =
    richText(payload.rich_text || []);

  switch (type) {
    case 'paragraph':
      return text
        ? `<p>${text}</p>`
        : '';

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
      return `
        <pre><code>${escapeHtml(
          plain(payload.rich_text || [])
        )}</code></pre>
      `;

    case 'image': {
      const src =
        payload.external?.url ||
        payload.file?.url ||
        '';

      const alt =
        plain(payload.caption || []);

      if (!src) {
        return '';
      }

      return `
        <figure>
          <img
            src="${escapeHtml(src)}"
            alt="${escapeHtml(
              alt || 'Article image'
            )}"
            loading="lazy"
            decoding="async"
          >
          ${
            alt
              ? `<figcaption>${escapeHtml(
                  alt
                )}</figcaption>`
              : ''
          }
        </figure>
      `;
    }

    default:
      return '';
  }
}

function normalizeLists(html) {
  return html
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/<\/ol>\s*<ol>/g, '');
}

async function renderBlocks(pageId) {
  const blocks =
    await children(pageId);

  return normalizeLists(
    blocks
      .map(blockToHtml)
      .filter(Boolean)
      .join('\n')
  );
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  ).format(date);
}

function renderJsonLd(article) {
  const canonical =
    article.canonicalUrl || '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline:
      article.seoTitle ||
      article.title ||
      'Difurrent Article',
    description:
      article.seoDescription ||
      article.description ||
      article.excerpt ||
      '',
    url: canonical,
    datePublished:
      article.publishDate || undefined,
    dateModified:
      article.modifiedDate ||
      article.publishDate ||
      undefined,
    author: {
      '@type': 'Person',
      name:
        article.author ||
        'Difurrent'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Difurrent',
      url: 'https://difurrent.com/'
    },
    image: article.cover
      ? [article.cover]
      : undefined
  };

  return JSON.stringify(schema);
}

function renderDocument(article, content) {
  const title =
    article.seoTitle ||
    article.title ||
    'Difurrent Article';

  const description =
    article.seoDescription ||
    article.description ||
    article.excerpt ||
    '';

  const canonical =
    article.canonicalUrl ||
    `https://difurrent.com/articles/${article.slug}/`;

  const cover =
    article.cover || '';

  const coverAlt =
    article.coverAlt ||
    article.title ||
    '';

  return `<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1"
>

<title>${escapeHtml(
    title
  )} | Difurrent</title>

<meta
  name="description"
  content="${escapeHtml(
    description
  )}"
>

<meta
  name="robots"
  content="index, follow"
>

<meta
  name="author"
  content="${escapeHtml(
    article.author ||
    'Difurrent'
  )}"
>

<link
  rel="canonical"
  href="${escapeHtml(
    canonical
  )}"
>

<link
  rel="icon"
  type="image/svg+xml"
  href="/assets/favicon/favicon.svg"
>

<link
  rel="icon"
  href="/assets/favicon/favicon.ico"
>

<link
  rel="apple-touch-icon"
  href="/assets/favicon/apple-touch-icon.png"
>

<meta
  name="theme-color"
  content="#0A0A0A"
  media="(prefers-color-scheme: dark)"
>

<meta
  name="theme-color"
  content="#FFFFFF"
  media="(prefers-color-scheme: light)"
>

<meta
  property="og:type"
  content="article"
>

<meta
  property="og:site_name"
  content="Difurrent"
>

<meta
  property="og:title"
  content="${escapeHtml(
    title
  )}"
>

<meta
  property="og:description"
  content="${escapeHtml(
    description
  )}"
>

<meta
  property="og:url"
  content="${escapeHtml(
    canonical
  )}"
>

<meta
  property="og:locale"
  content="en_US"
>

${
  cover
    ? `
<meta
  property="og:image"
  content="${escapeHtml(
    cover
  )}"
>

<meta
  property="og:image:alt"
  content="${escapeHtml(
    coverAlt
  )}"
>
`
    : ''
}

<meta
  name="twitter:card"
  content="summary_large_image"
>

<meta
  name="twitter:site"
  content="@difurrent"
>

<meta
  name="twitter:title"
  content="${escapeHtml(
    title
  )}"
>

<meta
  name="twitter:description"
  content="${escapeHtml(
    description
  )}"
>

${
  cover
    ? `
<meta
  name="twitter:image"
  content="${escapeHtml(
    cover
  )}"
>

<meta
  name="twitter:image:alt"
  content="${escapeHtml(
    coverAlt
  )}"
>
`
    : ''
}

<script
  type="application/ld+json"
>${renderJsonLd(article)}</script>

<link
  rel="stylesheet"
  href="/styles.css"
>

<script
  src="/script.js"
  defer
></script>

</head>

<body class="article-page">

<a
  class="skip-link"
  href="#main"
>
  Skip to content
</a>

<header class="site-header">

<div class="container header-inner">

<a
  class="wordmark"
  href="/"
  aria-label="Difurrent home"
>
  DIFURRENT
</a>

<nav
  class="desktop-nav"
  aria-label="Primary navigation"
>
  <a href="/#work">Work</a>
  <a href="/#about">About</a>
  <a
    href="/articles/"
    aria-current="page"
  >
    Writing
  </a>
  <a href="/#contact">Contact</a>
</nav>

<div class="header-actions">

<button
  class="theme-button"
  type="button"
  aria-label="Change theme"
  aria-expanded="false"
  aria-haspopup="menu"
>
  <span class="theme-button-label">
    System
  </span>
</button>

<a
  class="x-link"
  href="https://x.com/difurrent"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Difurrent on X"
>
  X
</a>

<a
  class="social-link"
  href="https://www.linkedin.com/company/difurrent/"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Difurrent on LinkedIn"
>
  in
</a>

<button
  class="menu-toggle"
  type="button"
  aria-expanded="false"
  aria-controls="mobile-nav"
  aria-label="Open navigation"
>
  <span></span>
  <span></span>
</button>

</div>

</div>

<div
  class="theme-menu"
  role="menu"
  aria-label="Theme selection"
  hidden
>

<button
  type="button"
  role="menuitemradio"
  data-theme-choice="system"
>
  System
</button>

<button
  type="button"
  role="menuitemradio"
  data-theme-choice="light"
>
  Light
</button>

<button
  type="button"
  role="menuitemradio"
  data-theme-choice="dark"
>
  Dark
</button>

</div>

<nav
  id="mobile-nav"
  class="mobile-nav"
  aria-label="Mobile navigation"
  aria-hidden="true"
>

<a href="/#work">Work</a>
<a href="/#about">About</a>

<a
  href="/articles/"
  aria-current="page"
>
  Writing
</a>

<a href="/#contact">
  Contact
</a>

<a
  href="https://x.com/difurrent"
  target="_blank"
  rel="noopener noreferrer"
>
  X / Twitter
</a>

<a
  href="https://www.linkedin.com/company/difurrent/"
  target="_blank"
  rel="noopener noreferrer"
>
  LinkedIn
</a>

</nav>

</header>

<main id="main">

<article>

<header class="article-header">

<div class="container article-header-inner">

<a
  class="article-back"
  href="/articles/"
>
  <span aria-hidden="true">←</span>
  All writing
</a>

<div
  class="article-meta"
  aria-label="Article information"
>

<span>
  ${escapeHtml(
    article.category ||
    'Technology'
  )}
</span>

<span aria-hidden="true">
  ·
</span>

<time
  datetime="${escapeHtml(
    article.publishDate || ''
  )}"
>
  ${escapeHtml(
    formatDate(
      article.publishDate
    )
  )}
</time>

${
  article.readingTime
    ? `
<span aria-hidden="true">
  ·
</span>

<span>
  ${escapeHtml(
    String(
      article.readingTime
    )
  )} min read
</span>
`
    : ''
}

</div>

<h1>
  ${escapeHtml(
    article.title ||
    title
  )}
</h1>

${
  description
    ? `
<p class="article-description">
  ${escapeHtml(
    description
  )}
</p>
`
    : ''
}

</div>

${
  cover
    ? `
<div class="article-cover">

<figure class="article-cover">

<img
  src="${escapeHtml(
    cover
  )}"
  alt="${escapeHtml(
    coverAlt
  )}"
  loading="eager"
  decoding="async"
>

</figure>

</div>
`
    : ''
}

</header>

<div class="article-layout container">

<aside
  class="article-toc"
  data-article-toc
  aria-label="Article contents"
>

<span class="toc-label">
  On this page
</span>

<nav aria-label="Article contents">
  <div data-toc-list></div>
</nav>

</aside>

<div class="article-content">

${content}

</div>

</div>

</article>

</main>

<footer class="site-footer">

<div class="container footer-inner">

<div>
  <strong>DIFURRENT</strong>
  <span>A different current.</span>
</div>

<div class="footer-links">

<a href="/#work">Work</a>
<a href="/articles/">Writing</a>
<a href="/#about">About</a>
<a href="/#contact">Contact</a>

<a
  href="https://www.linkedin.com/company/difurrent/"
  target="_blank"
  rel="noopener noreferrer"
>
  LinkedIn
</a>

<a
  href="https://x.com/difurrent"
  target="_blank"
  rel="noopener noreferrer"
>
  X
</a>

</div>

<span>
  © 2026 Difurrent
</span>

</div>

</footer>

<script>
  window.__ARTICLE__ = ${JSON.stringify(
    article
  )};
</script>

</body>

</html>`;
}

export default async function handler(req, res) {
  try {
    const slug =
      req.query?.slug;

    if (!slug) {
      return res
        .status(400)
        .send('Missing article slug');
    }

    if (
      !process.env.NOTION_TOKEN ||
      !databaseId
    ) {
      throw new Error(
        'Missing NOTION_TOKEN or NOTION_DATABASE_ID'
      );
    }

    const dataSourceId =
      await getDataSourceId();

    const query =
      await notion.dataSources.query({
        data_source_id:
          dataSourceId,
        page_size: 1,
        filter: {
          and: [
            {
              property: 'Slug',
              rich_text: {
                equals: slug
              }
            },
            {
              property: 'Type',
              select: {
                equals:
                  'Website Article'
              }
            },
            {
              property: 'Status',
              status: {
                equals:
                  'Published'
              }
            },
            {
              property:
                'Publish to Website',
              checkbox: {
                equals: true
              }
            },
            {
              property: 'Channel',
              multi_select: {
                contains:
                  'difurrent.com'
              }
            }
          ]
        }
      });

    const page =
      query.results[0];

    if (!page) {
      return res
        .status(404)
        .send('Article not found');
    }

    const article =
      mapArticle(page);

    const content =
      await renderBlocks(page.id);

    res.setHeader(
      'Cache-Control',
      `s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
    );

    res.setHeader(
      'Content-Type',
      'text/html; charset=utf-8'
    );

    return res
      .status(200)
      .send(
        renderDocument(
          article,
          content
        )
      );

  } catch (error) {
    console.error(
      'Difurrent article page error:',
      error
    );

    return res
      .status(500)
      .send(
        'Unable to load article'
      );
  }
}