(function () {
  'use strict';

  function getSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  }

  function updateMeta(name, content) {
    if (!content) return;

    let element = document.querySelector(`meta[name="${name}"]`);

    if (!element) {
      element = document.createElement('meta');
      element.setAttribute('name', name);
      document.head.appendChild(element);
    }

    element.setAttribute('content', content);
  }

  function updateProperty(property, content) {
    if (!content) return;

    let element = document.querySelector(
      `meta[property="${property}"]`
    );

    if (!element) {
      element = document.createElement('meta');
      element.setAttribute('property', property);
      document.head.appendChild(element);
    }

    element.setAttribute('content', content);
  }

  function updateCanonical(url) {
    if (!url) return;

    let link = document.querySelector(
      'link[rel="canonical"]'
    );

    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  function updateArticleJsonLd(article) {
    let script = document.querySelector(
      'script[data-article-jsonld]'
    );

    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(
        'data-article-jsonld',
        ''
      );
      document.head.appendChild(script);
    }

    const data = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title || '',
      description:
        article.seoDescription ||
        article.description ||
        article.excerpt ||
        '',
      url:
        article.canonicalUrl ||
        article.publishedUrl ||
        window.location.href,
      datePublished: article.publishDate || undefined,
      image: article.cover
        ? [article.cover]
        : undefined,
      publisher: {
        '@type': 'Organization',
        name: 'Difurrent',
        url: 'https://difurrent.com'
      }
    };

    script.textContent = JSON.stringify(
      data,
      null,
      2
    );
  }

  function renderCover(article) {
    const container = document.querySelector(
      '[data-notion-cover]'
    );

    if (!container) return;

    if (!article.cover) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    container.hidden = false;

    container.innerHTML = `
      <img
        src="${article.cover}"
        alt="${article.coverAlt || article.title || 'Article cover'}"
        loading="eager"
        decoding="async"
      >
    `;
  }

  function renderContent(article) {
    const content = document.querySelector(
      '[data-notion-content]'
    );

    if (!content) return;

    content.innerHTML = article.html || '';
  }

  function renderError(message) {
    const content = document.querySelector(
      '[data-notion-content]'
    );

    if (!content) return;

    content.innerHTML = `
      <p>${message}</p>
    `;
  }

  function setupArticleToc() {
    if (
      typeof window.setupArticleToc ===
      'function'
    ) {
      window.setupArticleToc();
      return;
    }

    const toc = document.querySelector(
      '[data-toc-list]'
    );

    const content = document.querySelector(
      '[data-notion-content]'
    );

    if (!toc || !content) return;

    const headings = content.querySelectorAll(
      'h2, h3'
    );

    if (!headings.length) {
      const wrapper = document.querySelector(
        '[data-article-toc]'
      );

      if (wrapper) {
        wrapper.hidden = true;
      }

      return;
    }

    toc.innerHTML = '';

    headings.forEach((heading, index) => {
      if (!heading.id) {
        heading.id =
          heading.textContent
            .trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-') ||
          `section-${index + 1}`;
      }

      const item =
        document.createElement('li');

      const link =
        document.createElement('a');

      link.href = `#${heading.id}`;
      link.textContent =
        heading.textContent.trim();

      if (heading.tagName === 'H3') {
        item.classList.add(
          'toc-subitem'
        );
      }

      item.appendChild(link);
      toc.appendChild(item);
    });
  }

  function updateArticle(article) {
    const title =
      article.seoTitle ||
      article.title ||
      'Difurrent Writing';

    const description =
      article.seoDescription ||
      article.description ||
      article.excerpt ||
      '';

    const canonical =
      article.canonicalUrl ||
      article.publishedUrl ||
      window.location.href;

    document.title =
      title.includes('Difurrent')
        ? title
        : `${title} | Difurrent`;

    updateMeta(
      'description',
      description
    );

    updateProperty(
      'og:title',
      title
    );

    updateProperty(
      'og:description',
      description
    );

    updateProperty(
      'og:url',
      canonical
    );

    updateProperty(
      'og:type',
      'article'
    );

    updateMeta(
      'twitter:title',
      title
    );

    updateMeta(
      'twitter:description',
      description
    );

    updateCanonical(canonical);

    if (article.cover) {
      updateProperty(
        'og:image',
        article.cover
      );

      updateMeta(
        'twitter:image',
        article.cover
      );
    }

    updateArticleJsonLd(article);
  }

  function renderArticle(article) {
    if (!article) {
      renderError(
        'Unable to load this article.'
      );
      return;
    }

    updateArticle(article);

    const title =
      document.querySelector(
        '[data-notion-title]'
      );

    const description =
      document.querySelector(
        '[data-notion-description]'
      );

    const category =
      document.querySelector(
        '[data-notion-category]'
      );

    const date =
      document.querySelector(
        '[data-notion-date]'
      );

    const readingTime =
      document.querySelector(
        '[data-notion-reading-time]'
      );

    const author =
      document.querySelector(
        '[data-notion-author]'
      );

    if (title) {
      title.textContent =
        article.title || '';
    }

    if (description) {
      description.textContent =
        article.excerpt ||
        article.description ||
        '';
    }

    if (category) {
      category.textContent =
        article.category ||
        article.topic?.[0] ||
        'Technology';
    }

    if (date) {
      date.textContent =
        article.publishDate || '';
    }

    if (readingTime) {
      readingTime.textContent =
        article.readingTime
          ? `${article.readingTime} min read`
          : '';
    }

    if (author) {
      if (article.author) {
        author.textContent =
          article.author;
      } else {
        author.textContent = '';
        author.hidden = true;
      }
    }

    renderCover(article);
    renderContent(article);
    setupArticleToc();
  }

  async function loadArticleFromApi() {
    const slug = getSlug();

    if (!slug) {
      renderError(
        'No article specified.'
      );
      return;
    }

    try {
      const response =
        await fetch(
          `/api/article?slug=${encodeURIComponent(
            slug
          )}`
        );

      if (!response.ok) {
        throw new Error(
          `Article request failed with status ${response.status}`
        );
      }

      const article =
        await response.json();

      renderArticle(article);
    } catch (error) {
      console.error(
        'Difurrent article error:',
        error
      );

      renderError(
        'Unable to load this article right now.'
      );
    }
  }

  /*
   * Server-rendered article path.
   *
   * article-page.js injects the article into
   * window.__ARTICLE__ before this script runs.
   *
   * This means the browser does not need to make
   * another request to /api/article.
   */
  if (window.__ARTICLE__) {
    renderArticle(
      window.__ARTICLE__
    );
    return;
  }

  /*
   * Legacy/client-rendered fallback.
   *
   * Keeps /articles/live.html?slug=...
   * working if someone still reaches it directly.
   */
  loadArticleFromApi();
})();