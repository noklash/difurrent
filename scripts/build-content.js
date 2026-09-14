import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import matter from "gray-matter";
import { marked } from "marked";

/*
|--------------------------------------------------------------------------
| Project paths
|--------------------------------------------------------------------------
*/

const ROOT = process.cwd();

const CONTENT_DIR = path.join(
    ROOT,
    "content"
);

const ARTICLES_DIR = path.join(
    CONTENT_DIR,
    "articles"
);

const SRC_DIR = path.join(
    ROOT,
    "src"
);

const PUBLIC_DIR = path.join(
    ROOT,
    "public"
);

const DIST_DIR = path.join(
    ROOT,
    "dist"
);

const DIST_ARTICLES_DIR = path.join(
    DIST_DIR,
    "articles"
);

const ARTICLE_TEMPLATE = path.join(
    SRC_DIR,
    "article-template.html"
);

const HOMEPAGE_TEMPLATE = path.join(
    SRC_DIR,
    "index.html"
);

/*
|--------------------------------------------------------------------------
| Site configuration
|--------------------------------------------------------------------------
*/

const SITE_URL = "https://difurrent.com";

/*
|--------------------------------------------------------------------------
| Supported image formats
|--------------------------------------------------------------------------
|
| The extension is discovered from the actual file.
|
| Example:
|
| cover
| cover.jpg
| cover.webp
| cover.png
|
| The builder uses whichever file actually exists.
|--------------------------------------------------------------------------
*/

const IMAGE_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".svg",
    ".avif"
];

/*
|--------------------------------------------------------------------------
| Required article frontmatter
|--------------------------------------------------------------------------
*/

const REQUIRED_FRONTMATTER = [
    "title",
    "description",
    "date",
    "category",
    "cover",
    "coverAlt"
];

/*
|--------------------------------------------------------------------------
| Build state
|--------------------------------------------------------------------------
*/

const articles = [];

const warnings = [];

const errors = [];

let skippedArticles = 0;

/*
|--------------------------------------------------------------------------
| Logging
|--------------------------------------------------------------------------
*/

function log(message = "") {
    console.log(message);
}

function warn(
    message,
    articleSlug = null
) {
    const formatted = articleSlug
        ? `${articleSlug}: ${message}`
        : `global: ${message}`;

    warnings.push(formatted);

    console.warn(
        `  ⚠ ${formatted}`
    );
}

function fatal(message) {
    errors.push(message);

    console.error(
        `  ✕ ${message}`
    );
}

/*
|--------------------------------------------------------------------------
| Filesystem helpers
|--------------------------------------------------------------------------
*/

function exists(filePath) {
    try {
        fs.accessSync(filePath);

        return true;
    } catch {
        return false;
    }
}

function ensureDirectory(directory) {
    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );
}

function readFile(filePath) {
    return fs.readFileSync(
        filePath,
        "utf8"
    );
}

function writeFile(
    filePath,
    content
) {
    ensureDirectory(
        path.dirname(filePath)
    );

    fs.writeFileSync(
        filePath,
        content,
        "utf8"
    );
}

function removeDirectory(directory) {
    if (!exists(directory)) {
        return;
    }

    fs.rmSync(
        directory,
        {
            recursive: true,
            force: true
        }
    );
}

function copyFile(
    source,
    destination
) {
    ensureDirectory(
        path.dirname(destination)
    );

    fs.copyFileSync(
        source,
        destination
    );
}

function listDirectory(directory) {
    if (!exists(directory)) {
        return [];
    }

    return fs.readdirSync(
        directory,
        {
            withFileTypes: true
        }
    );
}

function copyDirectory(
    sourceDirectory,
    destinationDirectory
) {
    ensureDirectory(
        destinationDirectory
    );

    const entries =
        listDirectory(
            sourceDirectory
        );

    for (const entry of entries) {
        const source = path.join(
            sourceDirectory,
            entry.name
        );

        const destination = path.join(
            destinationDirectory,
            entry.name
        );

        if (entry.isDirectory()) {
            copyDirectory(
                source,
                destination
            );
        } else {
            copyFile(
                source,
                destination
            );
        }
    }
}

/*
|--------------------------------------------------------------------------
| HTML escaping
|--------------------------------------------------------------------------
*/

function escapeHtml(value = "") {
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#39;"
        );
}

function escapeAttribute(
    value = ""
) {
    return escapeHtml(value);
}

/*
|--------------------------------------------------------------------------
| Date handling
|--------------------------------------------------------------------------
*/

function parseDate(value) {
    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}

function formatDate(value) {
    const date = parseDate(value);

    if (!date) {
        return String(value);
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

/*
|--------------------------------------------------------------------------
| Reading time
|--------------------------------------------------------------------------
*/

function calculateReadingTime(
    markdown
) {
    const plainText =
        String(markdown || "")
            /*
             * Remove fenced code blocks.
             */
            .replace(
                /```[\s\S]*?```/g,
                ""
            )

            /*
             * Remove inline code.
             */
            .replace(
                /`[^`]*`/g,
                ""
            )

            /*
             * Remove images.
             */
            .replace(
                /!\[[^\]]*\]\([^)]*\)/g,
                ""
            )

            /*
             * Convert links to their text.
             */
            .replace(
                /\[([^\]]*)\]\([^)]*\)/g,
                "$1"
            )

            /*
             * Remove common Markdown syntax.
             */
            .replace(
                /[#>*_~]/g,
                ""
            )

            .trim();

    const words =
        plainText
            .split(/\s+/)
            .filter(Boolean)
            .length;

    const minutes = Math.max(
        1,
        Math.ceil(words / 220)
    );

    return `${minutes} min read`;
}

/*
|--------------------------------------------------------------------------
| External asset detection
|--------------------------------------------------------------------------
*/

function isExternalAsset(
    assetPath
) {
    if (!assetPath) {
        return false;
    }

    return (
        assetPath.startsWith(
            "http://"
        ) ||
        assetPath.startsWith(
            "https://"
        ) ||
        assetPath.startsWith(
            "data:"
        )
    );
}

/*
|--------------------------------------------------------------------------
| Article asset resolution
|--------------------------------------------------------------------------
*/

function cleanRelativePath(
    relativePath
) {
    return String(relativePath)
        .replace(
            /^\.\/+/,
            ""
        )
        .replace(
            /^\/+/,
            ""
        );
}

function resolveArticleAsset(
    articleDirectory,
    relativePath
) {
    if (!relativePath) {
        return null;
    }

    const cleaned =
        cleanRelativePath(
            relativePath
        );

    return path.resolve(
        articleDirectory,
        cleaned
    );
}

function isInsideDirectory(
    targetPath,
    directory
) {
    const relative =
        path.relative(
            directory,
            targetPath
        );

    return (
        relative === "" ||
        (
            !relative.startsWith("..") &&
            !path.isAbsolute(relative)
        )
    );
}

/*
|--------------------------------------------------------------------------
| Exact asset lookup
|--------------------------------------------------------------------------
*/

function findExactAsset(
    articleDirectory,
    relativePath
) {
    const resolved =
        resolveArticleAsset(
            articleDirectory,
            relativePath
        );

    if (!resolved) {
        return null;
    }

    if (
        !isInsideDirectory(
            resolved,
            articleDirectory
        )
    ) {
        return null;
    }

    if (!exists(resolved)) {
        return null;
    }

    return resolved;
}

/*
|--------------------------------------------------------------------------
| Image lookup without depending on extension
|--------------------------------------------------------------------------
|
| This is the important part.
|
| If Markdown says:
|
|     ./architecture.webp
|
| but the actual file is:
|
|     architecture.png
|
| architecture.png is found.
|
| If Markdown says:
|
|     ./architecture
|
| the same lookup works.
|--------------------------------------------------------------------------
*/

function findImageByStem(
    articleDirectory,
    relativePath
) {
    if (!relativePath) {
        return null;
    }

    const cleaned =
        cleanRelativePath(
            relativePath
        );

    const parsed =
        path.parse(cleaned);

    const directory =
        path.resolve(
            articleDirectory,
            parsed.dir
        );

    const stem =
        parsed.name;

    if (
        !isInsideDirectory(
            directory,
            articleDirectory
        )
    ) {
        return null;
    }

    if (!exists(directory)) {
        return null;
    }

    const entries =
        listDirectory(
            directory
        );

    /*
     * Prefer exact filename if it exists.
     */
    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        if (
            entry.name ===
            parsed.base
        ) {
            return path.join(
                directory,
                entry.name
            );
        }
    }

    /*
     * Otherwise search supported image formats.
     */
    for (const extension of IMAGE_EXTENSIONS) {
        for (const entry of entries) {
            if (!entry.isFile()) {
                continue;
            }

            const candidate =
                path.parse(
                    entry.name
                );

            if (
                candidate.name === stem &&
                candidate.ext.toLowerCase() ===
                    extension
            ) {
                return path.join(
                    directory,
                    entry.name
                );
            }
        }
    }

    return null;
}

/*
|--------------------------------------------------------------------------
| General image resolution
|--------------------------------------------------------------------------
*/

function resolveImage(
    articleDirectory,
    relativePath
) {
    if (!relativePath) {
        return null;
    }

    /*
     * External images remain untouched.
     */
    if (
        isExternalAsset(
            relativePath
        )
    ) {
        return relativePath;
    }

    /*
     * First try the exact path.
     */
    const exact =
        findExactAsset(
            articleDirectory,
            relativePath
        );

    if (exact) {
        return exact;
    }

    /*
     * Then ignore the extension and search
     * for the actual image file.
     */
    return findImageByStem(
        articleDirectory,
        relativePath
    );
}

/*
|--------------------------------------------------------------------------
| Article image URL
|--------------------------------------------------------------------------
*/

function getArticleAssetUrl(
    article,
    assetPath
) {
    if (!assetPath) {
        return null;
    }

    if (
        isExternalAsset(
            assetPath
        )
    ) {
        return assetPath;
    }

    const relative =
        path.relative(
            article.directory,
            assetPath
        );

    if (
        relative === "" ||
        relative.startsWith("..") ||
        path.isAbsolute(relative)
    ) {
        return null;
    }

    const normalized =
        relative.replaceAll(
            path.sep,
            "/"
        );

    const encodedPath =
        normalized
            .split("/")
            .map(
                encodeURIComponent
            )
            .join("/");

    return (
        `/articles/${encodeURIComponent(
            article.slug
        )}/${encodedPath}`
    );
}

/*
|--------------------------------------------------------------------------
| Frontmatter validation
|--------------------------------------------------------------------------
*/

function validateFrontmatter(
    data,
    slug
) {
    const missing =
        REQUIRED_FRONTMATTER.filter(
            (field) =>
                data[field] ===
                    undefined ||
                data[field] === null ||
                String(data[field]).trim() ===
                    ""
        );

    if (
        missing.length > 0
    ) {
        warn(
            `Missing required frontmatter: ${missing.join(", ")}. Article will be skipped.`,
            slug
        );

        return false;
    }

    const parsedDate =
        parseDate(
            data.date
        );

    if (!parsedDate) {
        warn(
            `Invalid date in frontmatter: ${data.date}. Article will be skipped.`,
            slug
        );

        return false;
    }

    return true;
}

/*
|--------------------------------------------------------------------------
| Markdown image normalization
|--------------------------------------------------------------------------
|
| Missing images are removed.
|
| Existing images are rewritten to their
| actual filename and extension.
|--------------------------------------------------------------------------
*/

function normalizeImagePaths(
    article,
    markdown
) {
    if (!markdown) {
        return "";
    }

    const imageRegex =
        /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;

    return markdown.replace(
        imageRegex,
        (
            fullMatch,
            alt,
            imagePath,
            title
        ) => {
            /*
             * External image.
             */
            if (
                isExternalAsset(
                    imagePath
                )
            ) {
                return fullMatch;
            }

            /*
             * Find the actual image on disk.
             */
            const resolved =
                resolveImage(
                    article.directory,
                    imagePath
                );

            /*
             * Missing image:
             *
             * Remove it completely.
             */
            if (!resolved) {
                return "";
            }

            /*
             * Get the actual relative path.
             */
            const relative =
                path.relative(
                    article.directory,
                    resolved
                ).replaceAll(
                    path.sep,
                    "/"
                );

            const titlePart =
                title
                    ? ` "${title}"`
                    : "";

            return (
                `![${alt}](./${relative}${titlePart})`
            );
        }
    );
}

/*
|--------------------------------------------------------------------------
| Markdown rendering
|--------------------------------------------------------------------------
*/

function createHeadingId(
    text
) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(
            /<[^>]+>/g,
            ""
        )
        .replace(
            /[^\w\s-]/g,
            ""
        )
        .replace(
            /\s+/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        );
}

function renderMarkdown(
    markdown
) {
    const renderer =
        new marked.Renderer();

    renderer.heading =
        function ({
            text,
            depth
        }) {
            const id =
                createHeadingId(
                    text
                );

            return `
<h${depth} id="${escapeAttribute(id)}">
    ${text}
</h${depth}>
`;
        };

    renderer.image =
        function ({
            href,
            title,
            text
        }) {
            const safeHref =
                escapeAttribute(
                    href
                );

            const safeAlt =
                escapeAttribute(
                    text
                );

            const titleAttribute =
                title
                    ? ` title="${escapeAttribute(
                          title
                      )}"`
                    : "";

            return `
<figure class="article-image">
    <img
        src="${safeHref}"
        alt="${safeAlt}"${titleAttribute}
        loading="lazy"
        decoding="async"
    >
</figure>
`;
        };

    return marked.parse(
        markdown,
        {
            renderer,
            gfm: true
        }
    );
}

/*
|--------------------------------------------------------------------------
| Article cover
|--------------------------------------------------------------------------
*/

function resolveCover(
    article
) {
    if (!article.cover) {
        return null;
    }

    const resolved =
        resolveImage(
            article.directory,
            article.cover
        );

    if (!resolved) {
        /*
         * Missing cover is valid.
         *
         * No warning.
         */
        return null;
    }

    if (
        isExternalAsset(
            resolved
        )
    ) {
        return resolved;
    }

    if (
        !isInsideDirectory(
            resolved,
            article.directory
        )
    ) {
        return null;
    }

    return resolved;
}

function renderCover(
    article
) {
    if (!article.coverPath) {
        return "";
    }

    const imageUrl =
        getArticleAssetUrl(
            article,
            article.coverPath
        );

    if (!imageUrl) {
        return "";
    }

    return `
<figure class="article-cover">
    <img
        src="${escapeAttribute(imageUrl)}"
        alt="${escapeAttribute(article.coverAlt)}"
        loading="eager"
        fetchpriority="high"
        decoding="async"
    >
</figure>
`;
}

/*
|--------------------------------------------------------------------------
| Social image metadata
|--------------------------------------------------------------------------
*/

function renderSocialImage(
    article
) {
    if (!article.coverPath) {
        return "";
    }

    const imageUrl =
        getArticleAssetUrl(
            article,
            article.coverPath
        );

    if (!imageUrl) {
        return "";
    }

    /*
     * Social metadata should use an absolute URL.
     */
    const absoluteUrl =
        isExternalAsset(
            imageUrl
        )
            ? imageUrl
            : `${SITE_URL}${imageUrl}`;

    return `
<meta
    property="og:image"
    content="${escapeAttribute(absoluteUrl)}"
>
`;
}

function renderTwitterImage(
    article
) {
    if (!article.coverPath) {
        return "";
    }

    const imageUrl =
        getArticleAssetUrl(
            article,
            article.coverPath
        );

    if (!imageUrl) {
        return "";
    }

    const absoluteUrl =
        isExternalAsset(
            imageUrl
        )
            ? imageUrl
            : `${SITE_URL}${imageUrl}`;

    return `
<meta
    name="twitter:image"
    content="${escapeAttribute(absoluteUrl)}"
>
`;
}

/*
|--------------------------------------------------------------------------
| Author
|--------------------------------------------------------------------------
*/

function renderAuthor(
    author
) {
    if (!author) {
        return "";
    }

    return `
<p class="article-author">
    By ${escapeHtml(author)}
</p>
`;
}

/*
|--------------------------------------------------------------------------
| Article page
|--------------------------------------------------------------------------
*/

function renderArticlePage(
    article
) {
    const template =
        readFile(
            ARTICLE_TEMPLATE
        );

    /*
     * Normalize image references before Markdown rendering.
     */
    const normalizedMarkdown =
        normalizeImagePaths(
            article,
            article.markdown
        );

    const content =
        renderMarkdown(
            normalizedMarkdown
        );

    const readingTime =
        calculateReadingTime(
            normalizedMarkdown
        );

    const canonicalUrl =
        `${SITE_URL}/articles/${encodeURIComponent(
            article.slug
        )}/`;

    return template
        .replaceAll(
            "{{TITLE}}",
            escapeHtml(
                article.title
            )
        )
        .replaceAll(
            "{{DESCRIPTION}}",
            escapeHtml(
                article.description
            )
        )
        .replaceAll(
            "{{CANONICAL_URL}}",
            escapeAttribute(
                canonicalUrl
            )
        )
        .replaceAll(
            "{{OG_IMAGE}}",
            renderSocialImage(
                article
            )
        )
        .replaceAll(
            "{{TWITTER_IMAGE}}",
            renderTwitterImage(
                article
            )
        )
        .replaceAll(
            "{{CATEGORY}}",
            escapeHtml(
                article.category
            )
        )
        .replaceAll(
            "{{DATE}}",
            escapeAttribute(
                article.date
            )
        )
        .replaceAll(
            "{{FORMATTED_DATE}}",
            escapeHtml(
                formatDate(
                    article.date
                )
            )
        )
        .replaceAll(
            "{{READING_TIME}}",
            escapeHtml(
                readingTime
            )
        )
        .replaceAll(
            "{{AUTHOR}}",
            renderAuthor(
                article.author
            )
        )
        .replaceAll(
            "{{COVER}}",
            renderCover(
                article
            )
        )
        .replaceAll(
            "{{CONTENT}}",
            content
        );
}

/*
|--------------------------------------------------------------------------
| Article discovery
|--------------------------------------------------------------------------
*/

function discoverArticleDirectories() {
    if (!exists(ARTICLES_DIR)) {
        return [];
    }

    return listDirectory(
        ARTICLES_DIR
    )
        .filter(
            (entry) =>
                entry.isDirectory()
        )
        .map(
            (entry) => ({
                slug: entry.name,
                directory:
                    path.join(
                        ARTICLES_DIR,
                        entry.name
                    )
            })
        )
        .sort(
            (a, b) =>
                a.slug.localeCompare(
                    b.slug
                )
        );
}

/*
|--------------------------------------------------------------------------
| Article loading
|--------------------------------------------------------------------------
*/

function loadArticles() {
    log(
        "Discovering articles..."
    );

    const directories =
        discoverArticleDirectories();

    for (const entry of directories) {
        const {
            slug,
            directory
        } = entry;

        const markdownPath =
            path.join(
                directory,
                "article.md"
            );

        /*
         * Missing article.md.
         */
        if (!exists(markdownPath)) {
            warn(
                "article.md not found. Article will be skipped.",
                slug
            );

            skippedArticles += 1;

            continue;
        }

        let parsed;

        try {
            parsed = matter(
                readFile(
                    markdownPath
                )
            );
        } catch (error) {
            warn(
                `Could not parse article.md: ${error.message}. Article will be skipped.`,
                slug
            );

            skippedArticles += 1;

            continue;
        }

        const data =
            parsed.data || {};

        const markdown =
            parsed.content || "";

        /*
         * Validate metadata.
         */
        if (
            !validateFrontmatter(
                data,
                slug
            )
        ) {
            skippedArticles += 1;

            continue;
        }

        const article = {
            slug,

            directory,

            title:
                String(
                    data.title
                ),

            description:
                String(
                    data.description
                ),

            date:
                String(
                    data.date
                ),

            category:
                String(
                    data.category
                ),

            author:
                data.author
                    ? String(
                          data.author
                      )
                    : null,

            featured:
                data.featured === true,

            cover:
                String(
                    data.cover
                ),

            coverAlt:
                String(
                    data.coverAlt
                ),

            markdown
        };

        /*
         * Resolve the actual cover file.
         *
         * No warning if it doesn't exist.
         */
        article.coverPath =
            resolveCover(
                article
            );

        articles.push(
            article
        );

        log(
            `  ✓ Loaded: ${slug}`
        );
    }

    /*
     * Newest first.
     */
    articles.sort(
        (a, b) =>
            new Date(b.date) -
            new Date(a.date)
    );
}

/*
|--------------------------------------------------------------------------
| Publish articles
|--------------------------------------------------------------------------
*/

function publishArticles() {
    log("");

    log(
        `Publishing ${articles.length} article(s)...`
    );

    /*
     * We may remove an article from the list if
     * rendering fails, so iterate over a copy.
     */
    for (
        const article of [...articles]
    ) {
        const outputDirectory =
            path.join(
                DIST_ARTICLES_DIR,
                article.slug
            );

        try {
            ensureDirectory(
                outputDirectory
            );

            /*
             * Copy every asset except article.md.
             *
             * This means an article can contain:
             *
             * images
             * SVG
             * GIF
             * video
             * data
             * diagrams
             * etc.
             */
            copyArticleAssets(
                article.directory,
                outputDirectory
            );

            const html =
                renderArticlePage(
                    article
                );

            writeFile(
                path.join(
                    outputDirectory,
                    "index.html"
                ),
                html
            );

            log(
                `  ✓ Published /articles/${article.slug}/`
            );
        } catch (error) {
            /*
             * Content/rendering failure.
             *
             * Do not kill the build.
             */
            warn(
                `Failed to build article: ${error.message}. Article will be skipped.`,
                article.slug
            );

            skippedArticles += 1;

            removeDirectory(
                outputDirectory
            );

            /*
             * Remove failed article from
             * generated article lists.
             */
            const index =
                articles.indexOf(
                    article
                );

            if (index !== -1) {
                articles.splice(
                    index,
                    1
                );
            }
        }
    }
}

function copyArticleAssets(
    articleDirectory,
    outputDirectory
) {
    const entries =
        listDirectory(
            articleDirectory
        );

    for (const entry of entries) {
        /*
         * Markdown becomes index.html.
         */
        if (
            entry.name.toLowerCase() ===
            "article.md"
        ) {
            continue;
        }

        const source =
            path.join(
                articleDirectory,
                entry.name
            );

        const destination =
            path.join(
                outputDirectory,
                entry.name
            );

        if (entry.isDirectory()) {
            copyDirectory(
                source,
                destination
            );
        } else {
            copyFile(
                source,
                destination
            );
        }
    }
}

/*
|--------------------------------------------------------------------------
| Homepage article cards
|--------------------------------------------------------------------------
*/

function renderArticleCard(
    article
) {
    const articleUrl =
        `/articles/${encodeURIComponent(
            article.slug
        )}/`;

    let coverMarkup = "";

    if (article.coverPath) {
        const imageUrl =
            getArticleAssetUrl(
                article,
                article.coverPath
            );

        if (imageUrl) {
            coverMarkup = `
<figure class="article-card-image">
    <img
        src="${escapeAttribute(imageUrl)}"
        alt="${escapeAttribute(article.coverAlt)}"
        loading="lazy"
        decoding="async"
    >
</figure>
`;
        }
    }

    const authorMarkup =
        article.author
            ? `
<span>
    ${escapeHtml(article.author)}
</span>
`
            : "";

    return `
<article class="article-card">

    ${coverMarkup}

    <div class="article-card-content">

        <div class="article-card-meta">

            <span>
                ${escapeHtml(
                    article.category
                )}
            </span>

            <span>·</span>

            <time
                datetime="${escapeAttribute(
                    article.date
                )}"
            >
                ${escapeHtml(
                    formatDate(
                        article.date
                    )
                )}
            </time>

        </div>

        <h3>
            <a href="${articleUrl}">
                ${escapeHtml(
                    article.title
                )}
            </a>
        </h3>

        <p>
            ${escapeHtml(
                article.description
            )}
        </p>

        <div class="article-card-footer">

            ${authorMarkup}

            <span>
                ${escapeHtml(
                    calculateReadingTime(
                        article.markdown
                    )
                )}
            </span>

            <a
                class="text-button"
                href="${articleUrl}"
            >
                Read
                <span>↗</span>
            </a>

        </div>

    </div>

</article>
`;
}

function renderHomepageArticles() {
    if (
        articles.length === 0
    ) {
        return `
<p class="empty-state">
    No articles published yet.
</p>
`;
    }

    return articles
        .map(
            renderArticleCard
        )
        .join("\n");
}

/*
|--------------------------------------------------------------------------
| Homepage
|--------------------------------------------------------------------------
*/

function buildHomepage() {
    log("");

    log(
        "Building homepage..."
    );

    if (
        !exists(
            HOMEPAGE_TEMPLATE
        )
    ) {
        throw new Error(
            `Homepage template not found: ${HOMEPAGE_TEMPLATE}`
        );
    }

    let homepage =
        readFile(
            HOMEPAGE_TEMPLATE
        );

    if (
        homepage.includes(
            "data-notion-articles"
        )
    ) {
        writeFile(
            path.join(
                DIST_DIR,
                "index.html"
            ),
            homepage
        );

        log(
            "  ✓ Homepage (live Notion articles)"
        );

        return;
    }

    const startMarker =
        "<!-- ARTICLES:START -->";

    const endMarker =
        "<!-- ARTICLES:END -->";

    const startIndex =
        homepage.indexOf(
            startMarker
        );

    const endIndex =
        homepage.indexOf(
            endMarker
        );

    if (
        startIndex === -1 ||
        endIndex === -1
    ) {
        throw new Error(
            "Homepage article markers not found. Expected <!-- ARTICLES:START --> and <!-- ARTICLES:END -->."
        );
    }

    if (
        endIndex <= startIndex
    ) {
        throw new Error(
            "Homepage article markers are in the wrong order."
        );
    }

    const before =
        homepage.slice(
            0,
            startIndex +
                startMarker.length
        );

    const after =
        homepage.slice(
            endIndex
        );

    homepage =
        `${before}

${renderHomepageArticles()}

${after}`;

    writeFile(
        path.join(
            DIST_DIR,
            "index.html"
        ),
        homepage
    );

    log(
        "  ✓ Homepage"
    );
}

/*
|--------------------------------------------------------------------------
| Article index
|--------------------------------------------------------------------------
|
| This is generated directly.
|
| There is intentionally NO:
|
|     src/articles-index-template.html
|
|--------------------------------------------------------------------------
*/

function renderArticlesIndex() {
    const cards = `
<div data-notion-articles data-limit="12"></div>
<script src="/notion-articles.js"></script>
`;

    return `<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <meta
        name="description"
        content="Writing and technical investigations from Difurrent."
    >

    <meta
        name="theme-color"
        content="#f4f4f1"
    >

    <meta
        property="og:type"
        content="website"
    >

    <meta
        property="og:title"
        content="Writing — Difurrent"
    >

    <meta
        property="og:description"
        content="Writing and technical investigations from Difurrent."
    >

    <meta
        property="og:url"
        content="${SITE_URL}/articles/"
    >

    <meta
        name="twitter:card"
        content="summary_large_image"
    >

    <meta
        name="twitter:title"
        content="Writing — Difurrent"
    >

    <meta
        name="twitter:description"
        content="Writing and technical investigations from Difurrent."
    >

    <title>Writing — Difurrent</title>

    <script>
        (() => {
            const systemTheme =
                window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";

            let theme = systemTheme;

            try {
                const savedConsent =
                    localStorage.getItem("difurrent-consent");

                const consent = savedConsent
                    ? JSON.parse(savedConsent)
                    : null;

                if (consent?.preferences === true) {
                    const savedTheme =
                        localStorage.getItem("difurrent-theme");

                    if (
                        savedTheme === "light" ||
                        savedTheme === "dark"
                    ) {
                        theme = savedTheme;
                    }
                }
            } catch {
                // System theme remains active.
            }

            document.documentElement.dataset.theme = theme;
        })();
    </script>

    <link
        rel="stylesheet"
        href="/styles.css"
    >

    <script
        src="/script.js"
        defer
    ></script>

</head>

<body>

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
            <a href="/articles/">Writing</a>
            <a href="/#contact">Contact</a>
        </nav>

        <div class="header-actions">

            <button
                class="theme-button"
                type="button"
                aria-label="Change theme"
                aria-expanded="false"
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
            >
                X
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

    <div class="theme-menu" hidden>

        <button
            type="button"
            data-theme-choice="system"
        >
            System
        </button>

        <button
            type="button"
            data-theme-choice="light"
        >
            Light
        </button>

        <button
            type="button"
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
        <a href="/articles/">Writing</a>
        <a href="/#contact">Contact</a>
    </nav>

</header>

<main id="main">

    <section class="article-index-header">

        <div class="container">

            <a
                class="article-back"
                href="/"
            >
                ← Difurrent
            </a>

            <span class="eyebrow">
                Writing
            </span>

            <h1>
                Notes from the current.
            </h1>

            <p>
                Technical investigations, engineering notes,
                and observations from building systems.
            </p>

        </div>

    </section>

    <section class="writing section">

        <div class="container">

            <div class="article-grid">

                ${cards}

            </div>

        </div>

    </section>

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
        </div>

        <span>
            © 2026 Difurrent
        </span>

    </div>

</footer>

</body>

</html>
`;
}

function buildArticlesIndex() {
    log("");

    log(
        "Building article index..."
    );

    const output =
        renderArticlesIndex();

    writeFile(
        path.join(
            DIST_ARTICLES_DIR,
            "index.html"
        ),
        output
    );

    log(
        "  ✓ Articles index"
    );
}

/*
|--------------------------------------------------------------------------
| Sitemap
|--------------------------------------------------------------------------
*/

function buildSitemap() {
    log("");

    log(
        "Building sitemap..."
    );

    const urls = [
        `${SITE_URL}/`,
        `${SITE_URL}/articles/`
    ];

    for (const article of articles) {
        urls.push(
            `${SITE_URL}/articles/${encodeURIComponent(
                article.slug
            )}/`
        );
    }

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
${urls
    .map(
        (url) =>
            `    <url>
        <loc>${escapeHtml(
            url
        )}</loc>
    </url>`
    )
    .join("\n")}
</urlset>
`;

    writeFile(
        path.join(
            DIST_DIR,
            "sitemap.xml"
        ),
        xml
    );

    log(
        "  ✓ sitemap.xml"
    );
}

/*
|--------------------------------------------------------------------------
| robots.txt
|--------------------------------------------------------------------------
*/

function buildRobots() {
    log("");

    log(
        "Building robots.txt..."
    );

    const robots =
        `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

    writeFile(
        path.join(
            DIST_DIR,
            "robots.txt"
        ),
        robots
    );

    log(
        "  ✓ robots.txt"
    );
}

/*
|--------------------------------------------------------------------------
| Public/static assets
|--------------------------------------------------------------------------
*/

function copyStaticAssets() {
    if (
        !exists(
            PUBLIC_DIR
        )
    ) {
        return;
    }

    const entries =
        listDirectory(
            PUBLIC_DIR
        );

    for (const entry of entries) {
        const source =
            path.join(
                PUBLIC_DIR,
                entry.name
            );

        const destination =
            path.join(
                DIST_DIR,
                entry.name
            );

        if (entry.isDirectory()) {
            copyDirectory(
                source,
                destination
            );
        } else {
            copyFile(
                source,
                destination
            );
        }
    }
}

/*
|--------------------------------------------------------------------------
| Build summary
|--------------------------------------------------------------------------
*/

function printSummary() {
    log("");

    log(
        "----------------------------------------"
    );

    log(
        "Build summary"
    );

    log(
        "----------------------------------------"
    );

    log(
        `Built:    ${articles.length}`
    );

    log(
        `Skipped:  ${skippedArticles}`
    );

    log(
        `Warnings: ${warnings.length}`
    );

    log(
        `Errors:   ${errors.length}`
    );

    if (
        warnings.length > 0
    ) {
        log("");

        log(
            "Warnings:"
        );

        for (
            const warning of warnings
        ) {
            log(
                `  ⚠ ${warning}`
            );
        }
    }

    if (
        errors.length > 0
    ) {
        log("");

        log(
            "Errors:"
        );

        for (
            const error of errors
        ) {
            log(
                `  ✕ ${error}`
            );
        }
    }

    log("");

    log(
        "----------------------------------------"
    );

    if (
        errors.length > 0
    ) {
        log(
            "Build failed."
        );
    } else if (
        warnings.length > 0
    ) {
        log(
            "Build completed with warnings."
        );
    } else {
        log(
            "Build completed successfully."
        );
    }

    log(
        "----------------------------------------"
    );
}

/*
|--------------------------------------------------------------------------
| Main build
|--------------------------------------------------------------------------
*/

function build() {
    log("");
    log(
        "Building Difurrent..."
    );
    log("");

    /*
     * Validate critical templates before
     * touching the existing build output.
     */
    if (
        !exists(
            ARTICLE_TEMPLATE
        )
    ) {
        fatal(
            `Article template not found: ${ARTICLE_TEMPLATE}`
        );

        printSummary();

        process.exitCode = 1;

        return;
    }

    if (
        !exists(
            HOMEPAGE_TEMPLATE
        )
    ) {
        fatal(
            `Homepage template not found: ${HOMEPAGE_TEMPLATE}`
        );

        printSummary();

        process.exitCode = 1;

        return;
    }

    /*
     * Prepare output directory.
     *
     * This is a build-system operation, so a
     * filesystem failure is fatal.
     */
    try {
        log(
            "Preparing output directory..."
        );

        removeDirectory(
            DIST_DIR
        );

        ensureDirectory(
            DIST_DIR
        );

        ensureDirectory(
            DIST_ARTICLES_DIR
        );
    } catch (error) {
        fatal(
            `Could not prepare output directory: ${error.message}`
        );

        printSummary();

        process.exitCode = 1;

        return;
    }

    /*
     * Content discovery.
     *
     * Content problems are handled gracefully.
     */
    loadArticles();

    /*
     * Build the generated site.
     */
    try {
        publishArticles();

        buildHomepage();

        buildArticlesIndex();

        buildSitemap();

        buildRobots();

        copyStaticAssets();
    } catch (error) {
        /*
         * This represents a real build-system failure.
         */
        fatal(
            `Fatal build error: ${error.message}`
        );

        printSummary();

        process.exitCode = 1;

        return;
    }

    printSummary();
}

build();