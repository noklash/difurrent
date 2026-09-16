"use strict";

(() => {
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

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "short",
            day: "numeric"
        }).format(date);
    }

    function createArticleCard(article, index) {
        const href =
            `/articles/live.html?slug=${encodeURIComponent(article.slug)}`;

        const title = escapeHtml(article.title || "Untitled article");
        const category = escapeHtml(article.category || "Technology");
        const excerpt = escapeHtml(article.excerpt || "");
        const date = formatDate(article.publishDate);
        const readingTime = article.readingTime
            ? `${escapeHtml(article.readingTime)} min read`
            : "Article";

        const isFeatured = index === 0;

        return `
            <article class="article-card${isFeatured ? " article-card-featured" : ""}">
                <a
                    class="article-card-media"
                    href="${href}"
                    aria-label="Read ${title}"
                >
                    ${
                        article.cover
                            ? `
                                <img
                                    src="${escapeHtml(article.cover)}"
                                    alt="${escapeHtml(
                                        article.coverAlt || article.title || ""
                                    )}"
                                    loading="${isFeatured ? "eager" : "lazy"}"
                                    decoding="async"
                                >
                            `
                            : `
                                <span class="article-card-placeholder">
                                    <span>DIFURRENT</span>
                                    <span>FIELD NOTE / ${String(index + 1).padStart(2, "0")}</span>
                                </span>
                            `
                    }

                    <span class="article-card-index">
                        ${String(index + 1).padStart(2, "0")}
                    </span>
                </a>

                <div class="article-card-body">
                    <div class="article-card-meta">
                        <span>${category}</span>

                        ${
                            date
                                ? `
                                    <span class="article-card-separator">
                                        /
                                    </span>

                                    <time datetime="${escapeHtml(
                                        article.publishDate
                                    )}">
                                        ${escapeHtml(date)}
                                    </time>
                                `
                                : ""
                        }

                        <span class="article-card-separator">
                            /
                        </span>

                        <span>${readingTime}</span>
                    </div>

                    <h3 class="article-card-title">
                        <a href="${href}">
                            ${title}
                        </a>
                    </h3>

                    ${
                        excerpt
                            ? `
                                <p class="article-card-excerpt">
                                    ${excerpt}
                                </p>
                            `
                            : ""
                    }

                    <a
                        class="article-card-link"
                        href="${href}"
                        aria-label="Read ${title}"
                    >
                        <span>Read article</span>
                        <span class="article-card-arrow" aria-hidden="true">
                            ↗
                        </span>
                    </a>
                </div>
            </article>
        `;
    }

    function renderArticles(articles) {
        container.innerHTML = `
            <div class="articles-grid">
                ${articles.map(createArticleCard).join("")}
            </div>
        `;
    }

    function renderEmpty() {
        container.innerHTML = `
            <div class="articles-empty">
                <span class="articles-empty-index">00</span>

                <div>
                    <p class="articles-empty-label">
                        WRITING / DATABASE
                    </p>

                    <p class="articles-empty-text">
                        No articles published yet. Technical notes,
                        experiments and field reports will appear here.
                    </p>
                </div>
            </div>
        `;
    }

    function renderError() {
        container.innerHTML = `
            <div class="articles-empty articles-error">
                <span class="articles-empty-index">!</span>

                <div>
                    <p class="articles-empty-label">
                        WRITING / UNAVAILABLE
                    </p>

                    <p class="articles-empty-text">
                        The article index could not be loaded.
                        Please try again later.
                    </p>
                </div>
            </div>
        `;
    }

    fetch("/api/articles", {
        headers: {
            Accept: "application/json"
        }
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(
                    `Article request failed: ${response.status}`
                );
            }

            return response.json();
        })
        .then((data) => {
            if (!data || typeof data !== "object") {
                throw new Error("Invalid article response.");
            }

            let articles = Array.isArray(data.articles)
                ? data.articles
                : [];

            if (featuredOnly) {
                articles = articles.filter(
                    (article) => article.featured === true
                );
            }

            articles = articles.slice(0, Math.max(0, limit));

            if (!articles.length) {
                renderEmpty();
                return;
            }

            renderArticles(articles);
        })
        .catch((error) => {
            console.error("[Difurrent] Article index error:", error);
            renderError();
        });
})();