"use strict";

document.addEventListener(
    "DOMContentLoaded",
    () => {
        setupMobileNavigation();
        setupTheme();
        setupConsent();
        setupProjectDialog();
        setupArticleToc();
        setupReveal();
    }
);

/*
|--------------------------------------------------------------------------
| Mobile navigation
|--------------------------------------------------------------------------
*/

function setupMobileNavigation() {
    const toggle =
        document.querySelector(
            ".menu-toggle"
        );

    const mobileNav =
        document.querySelector(
            ".mobile-nav"
        );

    if (!toggle || !mobileNav) {
        return;
    }

    const links =
        mobileNav.querySelectorAll("a");

    function setMenu(open) {
        toggle.setAttribute(
            "aria-expanded",
            String(open)
        );

        toggle.setAttribute(
            "aria-label",
            open
                ? "Close navigation"
                : "Open navigation"
        );

        mobileNav.classList.toggle(
            "is-open",
            open
        );

        mobileNav.setAttribute(
            "aria-hidden",
            String(!open)
        );

        document.body.classList.toggle(
            "nav-open",
            open
        );
    }

    toggle.addEventListener(
        "click",
        () => {
            const open =
                toggle.getAttribute(
                    "aria-expanded"
                ) === "true";

            setMenu(!open);
        }
    );

    links.forEach(
        link => {
            link.addEventListener(
                "click",
                () => setMenu(false)
            );
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape"
            ) {
                setMenu(false);
            }
        }
    );
}

/*
|--------------------------------------------------------------------------
| Theme
|--------------------------------------------------------------------------
*/

function getSystemTheme() {
    return window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches
        ? "dark"
        : "light";
}

function getStoredTheme() {
    try {
        const consent =
            JSON.parse(
                localStorage.getItem(
                    "difurrent-consent"
                ) || "null"
            );

        if (
            consent?.preferences !== true
        ) {
            return null;
        }

        const theme =
            localStorage.getItem(
                "difurrent-theme"
            );

        if (
            theme === "light" ||
            theme === "dark"
        ) {
            return theme;
        }

        return null;

    } catch {
        return null;
    }
}

function getThemeMode() {
    try {
        return (
            localStorage.getItem(
                "difurrent-theme-mode"
            ) || "system"
        );
    } catch {
        return "system";
    }
}

function applyThemeMode(mode) {
    const theme =
        mode === "dark"
            ? "dark"
            : mode === "light"
                ? "light"
                : getSystemTheme();

    document.documentElement.dataset.theme =
        theme;

    updateThemeLabel(mode);
}

function updateThemeLabel(mode) {
    const labels =
        document.querySelectorAll(
            ".theme-button-label"
        );

    labels.forEach(
        label => {
            label.textContent =
                mode.charAt(0).toUpperCase() +
                mode.slice(1);
        }
    );
}

function setupTheme() {
    const button =
        document.querySelector(
            ".theme-button"
        );

    const menu =
        document.querySelector(
            ".theme-menu"
        );

    if (!button || !menu) {
        return;
    }

    let currentMode =
        getThemeMode();

    applyThemeMode(
        currentMode
    );

    button.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            const hidden =
                menu.hasAttribute("hidden");

            if (hidden) {
                menu.removeAttribute(
                    "hidden"
                );
            } else {
                menu.setAttribute(
                    "hidden",
                    ""
                );
            }

            button.setAttribute(
                "aria-expanded",
                String(hidden)
            );
        }
    );

    const choices =
        menu.querySelectorAll(
            "[data-theme-choice]"
        );

    choices.forEach(
        choice => {

            choice.addEventListener(
                "click",
                () => {

                    const mode =
                        choice.dataset
                            .themeChoice;

                    currentMode =
                        mode;

                    applyThemeMode(
                        mode
                    );

                    if (
                        hasPreferenceConsent()
                    ) {
                        try {
                            localStorage.setItem(
                                "difurrent-theme-mode",
                                mode
                            );

                            if (
                                mode === "light" ||
                                mode === "dark"
                            ) {
                                localStorage.setItem(
                                    "difurrent-theme",
                                    mode
                                );
                            } else {
                                localStorage.removeItem(
                                    "difurrent-theme"
                                );
                            }
                        } catch {
                            // Persistence unavailable.
                        }
                    }

                    menu.setAttribute(
                        "hidden",
                        ""
                    );

                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                }
            );
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                !menu.contains(
                    event.target
                ) &&
                !button.contains(
                    event.target
                )
            ) {
                menu.setAttribute(
                    "hidden",
                    ""
                );

                button.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );

    const media =
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        );

    media.addEventListener(
        "change",
        () => {
            if (
                getThemeMode() ===
                "system"
            ) {
                applyThemeMode(
                    "system"
                );
            }
        }
    );
}

function hasPreferenceConsent() {
    try {
        const consent =
            JSON.parse(
                localStorage.getItem(
                    "difurrent-consent"
                ) || "null"
            );

        return consent?.preferences === true;

    } catch {
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| Consent
|--------------------------------------------------------------------------
*/

function getConsent() {
    try {
        const stored =
            localStorage.getItem(
                "difurrent-consent"
            );

        return stored
            ? JSON.parse(stored)
            : null;

    } catch {
        return null;
    }
}

function saveConsent({
    preferences = false,
    analytics = false
}) {
    const consent = {
        version: 1,
        necessary: true,
        preferences,
        analytics,
        timestamp:
            new Date().toISOString()
    };

    try {
        localStorage.setItem(
            "difurrent-consent",
            JSON.stringify(consent)
        );
    } catch {
        return;
    }

    if (!preferences) {
        try {
            localStorage.removeItem(
                "difurrent-theme"
            );

            localStorage.removeItem(
                "difurrent-theme-mode"
            );
        } catch {}
    }

    if (analytics) {
        loadAnalytics();
    }
}

function loadAnalytics() {
    /*
     * Intentionally empty.
     *
     * When Difurrent actually adds an analytics
     * provider, initialize it here.
     *
     * Never load analytics before checking:
     *
     * consent.analytics === true
     */
}

function setupConsent() {
    const banner =
        document.querySelector(
            "[data-consent-banner]"
        );

    const modal =
        document.querySelector(
            "[data-consent-modal]"
        );

    if (!banner || !modal) {
        return;
    }

    const necessaryButton =
        document.querySelector(
            "[data-consent-necessary]"
        );

    const acceptAll =
        document.querySelector(
            "[data-consent-all]"
        );

    const manage =
        document.querySelector(
            "[data-consent-manage]"
        );

    const save =
        document.querySelector(
            "[data-consent-save]"
        );

    const closeButtons =
        document.querySelectorAll(
            "[data-consent-close]"
        );

    const preferences =
        document.querySelector(
            "[data-consent-preferences]"
        );

    const analytics =
        document.querySelector(
            "[data-consent-analytics]"
        );

    const existing =
        getConsent();

    if (!existing) {
        banner.removeAttribute(
            "hidden"
        );
    } else if (
        existing.analytics
    ) {
        loadAnalytics();
    }

    function openModal() {
        const current =
            getConsent();

        if (current) {
            preferences.checked =
                current.preferences === true;

            analytics.checked =
                current.analytics === true;
        }

        modal.removeAttribute(
            "hidden"
        );

        document.body.classList.add(
            "modal-open"
        );
    }

    function closeModal() {
        modal.setAttribute(
            "hidden",
            ""
        );

        document.body.classList.remove(
            "modal-open"
        );
    }

    necessaryButton?.addEventListener(
        "click",
        () => {
            saveConsent({
                preferences: false,
                analytics: false
            });

            banner.setAttribute(
                "hidden",
                ""
            );
        }
    );

    acceptAll?.addEventListener(
        "click",
        () => {
            saveConsent({
                preferences: true,
                analytics: true
            });

            banner.setAttribute(
                "hidden",
                ""
            );
        }
    );

    manage?.addEventListener(
        "click",
        () => {
            openModal();
        }
    );

    save?.addEventListener(
        "click",
        () => {
            saveConsent({
                preferences:
                    preferences.checked,
                analytics:
                    analytics.checked
            });

            banner.setAttribute(
                "hidden",
                ""
            );

            closeModal();
        }
    );

    closeButtons.forEach(
        button => {
            button.addEventListener(
                "click",
                closeModal
            );
        }
    );

    modal
        .querySelector(
            ".consent-modal-backdrop"
        )
        ?.addEventListener(
            "click",
            closeModal
        );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                !modal.hasAttribute("hidden")
            ) {
                closeModal();
            }
        }
    );
}

/*
|--------------------------------------------------------------------------
| Project dialog
|--------------------------------------------------------------------------
*/

function setupProjectDialog() {
    const dialog =
        document.querySelector(
            ".project-dialog"
        );

    const trigger =
        document.querySelector(
            ".project-dialog-trigger"
        );

    if (!dialog || !trigger) {
        return;
    }

    const closeButtons =
        dialog.querySelectorAll(
            ".dialog-close"
        );

    trigger.addEventListener(
        "click",
        () => {
            dialog.showModal();
        }
    );

    closeButtons.forEach(
        button => {
            button.addEventListener(
                "click",
                () => {
                    dialog.close();
                }
            );
        }
    );

    dialog.addEventListener(
        "click",
        event => {
            const rect =
                dialog.getBoundingClientRect();

            const outside =
                event.clientX <
                    rect.left ||
                event.clientX >
                    rect.right ||
                event.clientY <
                    rect.top ||
                event.clientY >
                    rect.bottom;

            if (outside) {
                dialog.close();
            }
        }
    );
}

/*
|--------------------------------------------------------------------------
| Article table of contents
|--------------------------------------------------------------------------
*/

function setupArticleToc() {
    const content =
        document.querySelector(
            ".article-content"
        );

    const toc =
        document.querySelector(
            "[data-toc-list]"
        );

    if (!content || !toc) {
        return;
    }

    const headings =
        content.querySelectorAll(
            "h2, h3"
        );

    if (!headings.length) {
        const aside =
            document.querySelector(
                ".article-toc"
            );

        aside?.remove();

        return;
    }

    headings.forEach(
        (heading, index) => {

            if (!heading.id) {
                heading.id =
                    createHeadingId(
                        heading.textContent,
                        index
                    );
            }

            const link =
                document.createElement(
                    "a"
                );

            link.href =
                `#${heading.id}`;

            link.textContent =
                heading.textContent;

            if (
                heading.tagName ===
                "H3"
            ) {
                link.classList.add(
                    "toc-subheading"
                );
            }

            toc.appendChild(
                link
            );
        }
    );
}

function createHeadingId(
    text,
    index
) {
    const base =
        text
            .toLowerCase()
            .trim()
            .replace(
                /[^a-z0-9\s-]/g,
                ""
            )
            .replace(
                /\s+/g,
                "-"
            );

    return (
        base ||
        `section-${index + 1}`
    );
}

/*
|--------------------------------------------------------------------------
| Reveal
|--------------------------------------------------------------------------
*/

function setupReveal() {
    const elements =
        document.querySelectorAll(
            ".section, .article-card, .area"
        );

    if (
        !elements.length ||
        !("IntersectionObserver" in window)
    ) {
        return;
    }

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        if (
                            entry.isIntersecting
                        ) {
                            entry.target.classList.add(
                                "is-visible"
                            );

                            observer.unobserve(
                                entry.target
                            );
                        }

                    }
                );

            },
            {
                threshold: 0.08
            }
        );

    elements.forEach(
        element => {
            observer.observe(
                element
            );
        }
    );
}