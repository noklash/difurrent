// Drop this into public/ and include it on your generated articles index page or homepage.
// It replaces a container with live Notion-powered article cards.
(function(){
  const container = document.querySelector('[data-notion-articles]');
  if (!container) return;
  const limit = Number(container.dataset.limit || 20);
  const featuredOnly = container.dataset.featured === 'true';
  fetch('/api/articles')
    .then(r => r.json())
    .then(data => {
      let articles = data.articles || [];
      if (featuredOnly) articles = articles.filter(a => a.featured);
      articles = articles.slice(0, limit);
      container.innerHTML = articles.map(a => `
        <article class="article-card reveal">
          ${a.cover ? `<a href="/articles/live.html?slug=${encodeURIComponent(a.slug)}"><img src="${a.cover}" alt="${a.coverAlt || a.title}" class="article-card__image"></a>` : ''}
          <p class="eyebrow">${a.category || 'Technology'}${a.publishDate ? ` · ${a.publishDate}` : ''}</p>
          <h3><a href="/articles/live.html?slug=${encodeURIComponent(a.slug)}">${a.title}</a></h3>
          <p>${a.excerpt || ''}</p>
        </article>`).join('') || '<p>No published articles yet.</p>';
    })
    .catch(err => { container.innerHTML = `<p>Could not load articles: ${err.message}</p>`; });
})();
