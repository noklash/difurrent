# Live Notion CMS integration for your existing Difurrent static site

This keeps your existing architecture, but makes articles live from Notion.

## Final architecture

Static site shell from your current generator:

- `src/index.html`
- `src/article-template.html`
- `public/script.js`
- `public/styles.css`
- `dist`

Live article data from Notion:

- `api/articles.js`
- `api/article.js`
- `public/notion-articles.js`
- `public/articles/live.html`
- `public/notion-article.js`

## Install

1. Copy `api/articles.js` and `api/article.js` into your repo `api/` folder.
2. Copy public files into your repo `public/` folder:
   - `notion-articles.js`
   - `notion-article.js`
   - `articles/live.html`
3. Install Notion SDK:

```bash
npm install @notionhq/client
```

4. Add Vercel env vars:

```txt
NOTION_TOKEN=your_personal_access_token
NOTION_DATABASE_ID=6c80fdd904224593a8a4dd3e51cfd3c5
NOTION_CMS_CACHE_SECONDS=120
```

5. Redeploy Vercel.

## Add live article list to a template

Where your homepage or `dist/articles/index.html` currently renders generated cards, add:

```html
<div data-notion-articles data-limit="12"></div>
<script src="/notion-articles.js"></script>
```

For featured posts only:

```html
<div data-notion-articles data-featured="true" data-limit="3"></div>
<script src="/notion-articles.js"></script>
```

## Article URLs

This package uses:

```txt
/articles/live.html?slug=your-slug
```

If you want pretty URLs like `/articles/your-slug/`, add a Vercel rewrite later.

## Publish from Notion

An article appears when:

- Type = Website Article
- Status = Published
- Publish to Website = checked
- Channel contains difurrent.com
- Slug is filled

With cache set to 120 seconds, changes should appear within about 2 minutes without redeploying.
