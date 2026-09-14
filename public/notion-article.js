(function(){
  const el = document.getElementById('notion-article');
  if (!el) return;
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { el.textContent = 'Missing article slug.'; return; }
  fetch('/api/article?slug=' + encodeURIComponent(slug))
    .then(r => r.json())
    .then(a => {
      if (a.error) throw new Error(a.error);
      document.title = a.seoTitle || a.title;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', a.seoDescription || a.description || '');
      el.innerHTML = `
        <header class="article-hero">
          <p class="eyebrow">${a.category || 'Technology'}${a.publishDate ? ` · ${a.publishDate}` : ''}</p>
          <h1>${a.title}</h1>
          ${a.excerpt ? `<p class="article-description">${a.excerpt}</p>` : ''}
          ${a.cover ? `<img src="${a.cover}" alt="${a.coverAlt || a.title}" class="article-cover">` : ''}
        </header>
        <div class="article-body">${a.html}</div>`;
      if (window.setupArticleToc) window.setupArticleToc();
    })
    .catch(err => { el.innerHTML = `<p>Could not load article: ${err.message}</p>`; });
})();
