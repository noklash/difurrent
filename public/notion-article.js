(function () {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");

    const titleEl = document.querySelector("[data-notion-title]");
    const descriptionEl = document.querySelector("[data-notion-description]");
    const categoryEl = document.querySelector("[data-notion-category]");
    const dateEl = document.querySelector("[data-notion-date]");
    const readingTimeEl = document.querySelector("[data-notion-reading-time]");
    const authorEl = document.querySelector("[data-notion-author]");
    const coverEl = document.querySelector("[data-notion-cover]");
    const contentEl = document.querySelector("[data-notion-content]");

    function setText(el, value) {
        if (!el) return;
        el.textContent = value || "";
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

    function updateMeta(name, content) {
        if (!content) return;
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("name", name);
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", content);
    }

    function updateProperty(property, content) {
        if (!content) return;
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("property", property);
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", content);
    }

    function updateCanonical(url) {
        if (!url) return;
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement("link");
            link.setAttribute("rel", "canonical");
            document.head.appendChild(link);
        }
        link.setAttribute("href", url);
    }

    if (!slug) {
        if (contentEl) {
            contentEl.innerHTML = "<p>Missing article slug.</p>";
        }
        return;
    }

    fetch(`/api/article?slug=${encodeURIComponent(slug)}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Article request failed: ${response.status}`);
            }
            return response.json();
        })
        .then((article) => {
            if (article.error) {
                throw new Error(article.error);
            }

            const title = article.seoTitle || article.title || "Difurrent Article";
            const description =
                article.seoDescription ||
                article.description ||
                article.excerpt ||
                "";

            document.title = `${title} — Difurrent`;

            updateMeta("description", description);
            updateProperty("og:title", title);
            updateProperty("og:description", description);
            updateProperty("og:url", article.canonicalUrl);
            updateProperty("og:type", "article");
            updateMeta("twitter:title", title);
            updateMeta("twitter:description", description);
            updateCanonical(article.canonicalUrl);

            if (article.cover) {
                updateProperty("og:image", article.cover);
                updateMeta("twitter:image", article.cover);
            }

            setText(titleEl, article.title);
            setText(descriptionEl, article.description || article.excerpt);
            setText(categoryEl, article.category || "Technology");

            if (dateEl) {
                dateEl.setAttribute("datetime", article.publishDate || "");
                dateEl.textContent = formatDate(article.publishDate);
            }

            setText(
                readingTimeEl,
                article.readingTime ? `${article.readingTime} min read` : ""
            );

            if (authorEl && article.author) {
                authorEl.hidden = false;
                authorEl.textContent = `By ${article.author}`;
            }

            if (coverEl) {
                coverEl.innerHTML = article.cover
                    ? `
                        <figure class="article-cover">
                            <img
                                src="${article.cover}"
                                alt="${article.coverAlt || article.title || ""}"
                            >
                        </figure>
                    `
                    : "";
            }

            if (contentEl) {
                contentEl.innerHTML = article.html || "<p>No article content.</p>";
            }

            if (typeof setupArticleToc === "function") {
                setupArticleToc();
            }
        })
        .catch((error) => {
            if (titleEl) titleEl.textContent = "Article unavailable";
            if (contentEl) {
                contentEl.innerHTML = `<p>${error.message}</p>`;
            }
        });
})();