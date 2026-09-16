"use strict";

(function () {
    const params = new URLSearchParams(
        window.location.search
    );

    const slug = params.get("slug");

    const titleEl = document.querySelector(
        "[data-notion-title]"
    );

    const descriptionEl = document.querySelector(
        "[data-notion-description]"
    );

    const categoryEl = document.querySelector(
        "[data-notion-category]"
    );

    const dateEl = document.querySelector(
        "[data-notion-date]"
    );

    const readingTimeEl = document.querySelector(
        "[data-notion-reading-time]"
    );

    const authorEl = document.querySelector(
        "[data-notion-author]"
    );

    const coverEl = document.querySelector(
        "[data-notion-cover]"
    );

    const contentEl = document.querySelector(
        "[data-notion-content]"
    );

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    function setText(element, value) {
        if (!element) {
            return;
        }

        element.textContent = value || "";
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat(
            "en",
            {
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        ).format(date);
    }

    function updateMeta(name, content) {
        if (!content) {
            return;
        }

        let meta = document.querySelector(
            `meta[name="${name}"]`
        );

        if (!meta) {
            meta = document.createElement("meta");

            meta.setAttribute(
                "name",
                name
            );

            document.head.appendChild(meta);
        }

        meta.setAttribute(
            "content",
            content
        );
    }

    function updateProperty(property, content) {
        if (!content) {
            return;
        }

        let meta = document.querySelector(
            `meta[property="${property}"]`
        );

        if (!meta) {
            meta = document.createElement("meta");

            meta.setAttribute(
                "property",
                property
            );

            document.head.appendChild(meta);
        }

        meta.setAttribute(
            "content",
            content
        );
    }

    function updateCanonical(url) {
        if (!url) {
            return;
        }

        let link = document.querySelector(
            'link[rel="canonical"]'
        );

        if (!link) {
            link = document.createElement("link");

            link.setAttribute(
                "rel",
                "canonical"
            );

            document.head.appendChild(link);
        }

        link.setAttribute(
            "href",
            url
        );
    }

    function updateArticleJsonLd(article) {
        const existing =
            document.querySelector(
                'script[data-article-schema]'
            );

        existing?.remove();

        const title =
            article.seoTitle ||
            article.title ||
            "Difurrent Article";

        const description =
            article.seoDescription ||
            article.description ||
            article.excerpt ||
            "";

        const canonicalUrl =
            article.canonicalUrl ||
            window.location.href;

        const published =
            article.publishDate || "";

        const schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "description": description,
            "url": canonicalUrl,
            "datePublished": published,
            "dateModified":
                article.modifiedDate ||
                published,
            "author": {
                "@type": "Person",
                "name":
                    article.author ||
                    "Difurrent"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Difurrent",
                "url": "https://difurrent.com/"
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": canonicalUrl
            }
        };

        if (article.cover) {
            schema.image = [
                article.cover
            ];
        }

        const script =
            document.createElement("script");

        script.type =
            "application/ld+json";

        script.dataset.articleSchema =
            "true";

        script.textContent =
            JSON.stringify(schema);

        document.head.appendChild(script);
    }

    function renderCover(article) {
        if (!coverEl) {
            return;
        }

        coverEl.replaceChildren();

        if (!article.cover) {
            return;
        }

        const figure =
            document.createElement("figure");

        figure.className =
            "article-cover";

        const image =
            document.createElement("img");

        image.src = article.cover;

        image.alt =
            article.coverAlt ||
            article.title ||
            "";

        image.loading = "eager";
        image.decoding = "async";

        figure.appendChild(image);
        coverEl.appendChild(figure);
    }

    function renderContent(article) {
        if (!contentEl) {
            return;
        }

        contentEl.innerHTML =
            article.html ||
            "<p>No article content.</p>";
    }

    function renderError(message) {
        if (titleEl) {
            titleEl.textContent =
                "Article unavailable";
        }

        if (descriptionEl) {
            descriptionEl.textContent = "";
        }

        if (contentEl) {
            contentEl.replaceChildren();

            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                message ||
                "The article could not be loaded.";

            contentEl.appendChild(
                paragraph
            );
        }

        if (coverEl) {
            coverEl.replaceChildren();
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Article metadata
    |--------------------------------------------------------------------------
    */

    function updateArticle(article) {
        const title =
            article.seoTitle ||
            article.title ||
            "Difurrent Article";

        const description =
            article.seoDescription ||
            article.description ||
            article.excerpt ||
            "";

        const canonicalUrl =
            article.canonicalUrl ||
            window.location.href;

        document.title =
            `${title} — Difurrent`;

        updateMeta(
            "description",
            description
        );

        updateProperty(
            "og:title",
            title
        );

        updateProperty(
            "og:description",
            description
        );

        updateProperty(
            "og:url",
            canonicalUrl
        );

        updateProperty(
            "og:type",
            "article"
        );

        updateMeta(
            "twitter:title",
            title
        );

        updateMeta(
            "twitter:description",
            description
        );

        updateCanonical(
            canonicalUrl
        );

        if (article.cover) {
            updateProperty(
                "og:image",
                article.cover
            );

            updateMeta(
                "twitter:image",
                article.cover
            );

            if (article.coverAlt) {
                updateProperty(
                    "og:image:alt",
                    article.coverAlt
                );

                updateMeta(
                    "twitter:image:alt",
                    article.coverAlt
                );
            }
        }

        updateArticleJsonLd(
            article
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Article rendering
    |--------------------------------------------------------------------------
    */

    function renderArticle(article) {
        updateArticle(article);

        setText(
            titleEl,
            article.title
        );

        setText(
            descriptionEl,
            article.description ||
            article.excerpt
        );

        setText(
            categoryEl,
            article.category ||
            "Technology"
        );

        if (dateEl) {
            const publishDate =
                article.publishDate || "";

            dateEl.setAttribute(
                "datetime",
                publishDate
            );

            dateEl.textContent =
                formatDate(
                    publishDate
                );
        }

        setText(
            readingTimeEl,
            article.readingTime
                ? `${article.readingTime} min read`
                : ""
        );

        if (authorEl) {
            if (article.author) {
                authorEl.hidden = false;

                authorEl.textContent =
                    `By ${article.author}`;
            } else {
                authorEl.hidden = true;
                authorEl.textContent = "";
            }
        }

        renderCover(article);
        renderContent(article);

        /*
         * Article content now exists in the DOM,
         * so build the table of contents.
         */
        if (
            typeof setupArticleToc ===
            "function"
        ) {
            setupArticleToc();
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Request
    |--------------------------------------------------------------------------
    */

    if (!slug) {
        renderError(
            "Missing article slug."
        );

        return;
    }

    const endpoint =
        `/api/article?slug=${encodeURIComponent(
            slug
        )}`;

    fetch(endpoint, {
        headers: {
            Accept: "application/json"
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    `Article request failed: ${response.status}`
                );
            }

            return response.json();
        })
        .then(article => {
            if (
                !article ||
                typeof article !== "object"
            ) {
                throw new Error(
                    "Invalid article response."
                );
            }

            if (article.error) {
                throw new Error(
                    article.error
                );
            }

            renderArticle(article);
        })
        .catch(error => {
            console.error(
                "Difurrent article error:",
                error
            );

            renderError(
                error.message
            );
        });
})();