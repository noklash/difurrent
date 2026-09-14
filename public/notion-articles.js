(function () {
    const container = document.querySelector("[data-notion-articles]");
    if (!container) return;

    const limit = Number(container.dataset.limit || 20);
    const featuredOnly = container.dataset.featured === "true";

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function formatDate(value) {
        if (!value) return "";
        try {
            return new Intl.DateTimeFormat("en", {
                year: "numeric",
                month: "long",
                day: "numeric"
            }).format(new Date(value));
        } catch {
            return value;
        }
    }

    fetch("/api/articles")
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Article request failed: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            let articles = data.articles || [];

            if (featuredOnly) {
                articles = articles.filter((article) => article.featured);
            }

            articles = articles.slice(0, limit);

            if (!articles.length) {
                container.innerHTML = `
                    <p class="empty-state">
                        No articles published yet. Technical notes and
                        field reports will appear here.
                    </p>
                `;
                return;
            }

            container.innerHTML = articles.map((article) => {
                const href = `/articles/live.html?slug=${encodeURIComponent(article.slug)}`;
                const date = formatDate(article.publishDate);

                return `
                    <article class="article-card reveal is-visible">
                        ${
                            article.cover
                                ? `
                                    <a href="${href}" class="article-card-image">
                                        <img
                                            src="${escapeHtml(article.cover)}"
                                            alt="${escapeHtml(article.coverAlt || article.title)}"
                                            loading="lazy"
                                        >
                                    </a>
                                `
                                : `
                                    <a href="${href}" class="article-card-image article-card-image-empty">
                                        <span>DIFURRENT</span>
                                    </a>
                                `
                        }

                        <div class="article-card-content">
                            <div class="article-card-meta">
                                <span>${escapeHtml(article.category || "Technology")}</span>
                                ${
                                    date
                                        ? `
                                            <span>·</span>
                                            <time datetime="${escapeHtml(article.publishDate)}">
                                                ${escapeHtml(date)}
                                            </time>
                                        `
                                        : ""
                                }
                            </div>

                            <h3>
                                <a href="${href}">
                                    ${escapeHtml(article.title)}
                                </a>
                            </h3>

                            ${
                                article.excerpt
                                    ? `<p>${escapeHtml(article.excerpt)}</p>`
                                    : ""
                            }

                            <div class="article-card-footer">
                                <span>
                                    ${
                                        article.readingTime
                                            ? `${escapeHtml(article.readingTime)} min read`
                                            : "Article"
                                    }
                                </span>
                                <a class="text-button" href="${href}">
                                    Read
                                    <span>↗</span>
                                </a>
                            </div>
                        </div>
                    </article>
                `;
            }).join("");
        })
        .catch((error) => {
            container.innerHTML = `
                <p class="empty-state">
                    Could not load articles: ${escapeHtml(error.message)}
                </p>
            `;
        });
})();