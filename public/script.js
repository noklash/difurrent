"use strict";

document.addEventListener("DOMContentLoaded", () => {
    setupMobileNavigation();
    setupTheme();
    setupConsent();
    setupProjectDialog();
    setupArticleToc();
    setupReveal();
});

/*
|--------------------------------------------------------------------------
| Shared helpers
|--------------------------------------------------------------------------
*/

function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function getConsent() {
    try {
        const stored = localStorage.getItem("difurrent-consent");

        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

function hasPreferenceConsent() {
    return getConsent()?.preferences === true;
}

function getThemeMode() {
    try {
        const mode = localStorage.getItem("difurrent-theme-mode");

        return ["system", "light", "dark"].includes(mode)
            ? mode
            : "system";
    } catch {
        return "system";
    }
}

function setStoredThemeMode(mode) {
    if (!hasPreferenceConsent()) {
        return;
    }

    try {
        if (mode === "system") {
            localStorage.removeItem("difurrent-theme-mode");
            localStorage.removeItem("difurrent-theme");
            return;
        }

        localStorage.setItem(
            "difurrent-theme-mode",
            mode
        );

        localStorage.setItem(
            "difurrent-theme",
            mode
        );
    } catch {
        // Browser storage may be unavailable.
    }
}

/*
|--------------------------------------------------------------------------
| Mobile navigation
|--------------------------------------------------------------------------
*/

function setupMobileNavigation() {
    const toggle = document.querySelector(".menu-toggle");
    const mobileNav = document.querySelector(".mobile-nav");

    if (!toggle || !mobileNav) {
        return;
    }

    const links = mobileNav.querySelectorAll("a");

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

    toggle.addEventListener("click", () => {
        const open =
            toggle.getAttribute("aria-expanded") === "true";

        setMenu(!open);
    });

    links.forEach(link => {
        link.addEventListener("click", () => {
            setMenu(false);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            setMenu(false);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            setMenu(false);
        }
    });
}

/*
|--------------------------------------------------------------------------
| Theme
|--------------------------------------------------------------------------
*/

function getActiveTheme(mode) {
    if (mode === "dark") {
        return "dark";
    }

    if (mode === "light") {
        return "light";
    }

    return getSystemTheme();
}

function applyThemeMode(mode) {
    const theme = getActiveTheme(mode);

    document.documentElement.dataset.theme = theme;

    updateThemeLabel(mode);
    updateThemeChoices(mode);
}

function updateThemeLabel(mode) {
    const label = document.querySelector(
        ".theme-button-label"
    );

    if (!label) {
        return;
    }

    label.textContent =
        mode.charAt(0).toUpperCase() +
        mode.slice(1);
}

function updateThemeChoices(mode) {
    const choices = document.querySelectorAll(
        "[data-theme-choice]"
    );

    choices.forEach(choice => {
        const selected =
            choice.dataset.themeChoice === mode;

        choice.setAttribute(
            "aria-checked",
            String(selected)
        );
    });
}

function setupTheme() {
    const button = document.querySelector(
        ".theme-button"
    );

    const menu = document.querySelector(
        ".theme-menu"
    );

    if (!button || !menu) {
        return;
    }

    let currentMode = getThemeMode();

    applyThemeMode(currentMode);

    function closeMenu() {
        menu.setAttribute("hidden", "");

        button.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    function openMenu() {
        menu.removeAttribute("hidden");

        button.setAttribute(
            "aria-expanded",
            "true"
        );
    }

    button.addEventListener("click", event => {
        event.stopPropagation();

        const isOpen =
            !menu.hasAttribute("hidden");

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    const choices = menu.querySelectorAll(
        "[data-theme-choice]"
    );

    choices.forEach(choice => {
        choice.addEventListener("click", () => {
            const mode =
                choice.dataset.themeChoice;

            if (
                !["system", "light", "dark"].includes(
                    mode
                )
            ) {
                return;
            }

            currentMode = mode;

            applyThemeMode(currentMode);
            setStoredThemeMode(currentMode);

            closeMenu();
        });
    });

    document.addEventListener("click", event => {
        if (
            !menu.contains(event.target) &&
            !button.contains(event.target)
        ) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });

    const media = window.matchMedia(
        "(prefers-color-scheme: dark)"
    );

    media.addEventListener("change", () => {
        if (getThemeMode() === "system") {
            applyThemeMode("system");
        }
    });
}

/*
|--------------------------------------------------------------------------
| Consent
|--------------------------------------------------------------------------
*/

function saveConsent({
    preferences = false,
    analytics = false
} = {}) {
    const consent = {
        version: 1,
        necessary: true,
        preferences: Boolean(preferences),
        analytics: Boolean(analytics),
        timestamp: new Date().toISOString()
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
        } catch {
            // Browser storage may be unavailable.
        }
    }

    if (analytics) {
        loadAnalytics();
    }
}

function loadAnalytics() {
    /*
     * Reserved for a future analytics provider.
     *
     * Analytics must only be initialized from this function
     * after explicit analytics consent has been granted.
     */
}

function setupConsent() {
    const banner = document.querySelector(
        "[data-consent-banner]"
    );

    const modal = document.querySelector(
        "[data-consent-modal]"
    );

    if (!banner || !modal) {
        return;
    }

    const necessaryButton = document.querySelector(
        "[data-consent-necessary]"
    );

    const acceptAll = document.querySelector(
        "[data-consent-all]"
    );

    const manage = document.querySelector(
        "[data-consent-manage]"
    );

    const save = document.querySelector(
        "[data-consent-save]"
    );

    const closeButtons = document.querySelectorAll(
        "[data-consent-close]"
    );

    const preferences = document.querySelector(
        "[data-consent-preferences]"
    );

    const analytics = document.querySelector(
        "[data-consent-analytics]"
    );

    const existing = getConsent();

    if (!existing) {
        banner.removeAttribute("hidden");
    } else if (existing.analytics === true) {
        loadAnalytics();
    }

    function openModal() {
        const current = getConsent();

        if (preferences) {
            preferences.checked =
                current?.preferences === true;
        }

        if (analytics) {
            analytics.checked =
                current?.analytics === true;
        }

        modal.removeAttribute("hidden");

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
                    preferences?.checked === true,

                analytics:
                    analytics?.checked === true
            });

            banner.setAttribute(
                "hidden",
                ""
            );

            closeModal();
        }
    );

    closeButtons.forEach(button => {
        button.addEventListener(
            "click",
            closeModal
        );
    });

    modal
        .querySelector(".consent-modal-backdrop")
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
    const dialog = document.querySelector(
        ".project-dialog"
    );

    const trigger = document.querySelector(
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
            if (!dialog.open) {
                dialog.showModal();
            }
        }
    );

    closeButtons.forEach(button => {
        button.addEventListener(
            "click",
            () => {
                dialog.close();
            }
        );
    });

    dialog.addEventListener(
        "click",
        event => {
            const rect =
                dialog.getBoundingClientRect();

            const clickedOutside =
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom;

            if (clickedOutside) {
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
    const content = document.querySelector(
        ".article-content"
    );

    const toc = document.querySelector(
        "[data-toc-list]"
    );

    const aside = document.querySelector(
        ".article-toc"
    );

    if (!content || !toc) {
        return;
    }

    const headings = content.querySelectorAll(
        "h2, h3"
    );

    if (!headings.length) {
        aside?.remove();
        return;
    }

    const usedIds = new Set();

    headings.forEach((heading, index) => {
        const id = getUniqueHeadingId(
            heading,
            index,
            usedIds
        );

        heading.id = id;
        usedIds.add(id);

        const link =
            document.createElement("a");

        link.href = `#${id}`;
        link.textContent =
            heading.textContent.trim();

        if (heading.tagName === "H3") {
            link.classList.add(
                "toc-subheading"
            );
        }

        link.addEventListener(
            "click",
            () => {
                history.replaceState(
                    null,
                    "",
                    `#${id}`
                );
            }
        );

        toc.appendChild(link);
    });
}

function getUniqueHeadingId(
    heading,
    index,
    usedIds
) {
    const base =
        heading.textContent
            .toLowerCase()
            .trim()
            .replace(
                /[^a-z0-9\s-]/g,
                ""
            )
            .replace(
                /\s+/g,
                "-"
            )
            .replace(
                /-+/g,
                "-"
            )
            .replace(
                /^-|-$/g,
                ""
            ) ||
        `section-${index + 1}`;

    let id = base;
    let counter = 2;

    while (usedIds.has(id)) {
        id = `${base}-${counter}`;
        counter++;
    }

    return id;
}

/*
|--------------------------------------------------------------------------
| Reveal animations
|--------------------------------------------------------------------------
*/

function setupReveal() {
    const elements =
        document.querySelectorAll(
            ".section, .article-card, .area"
        );

    if (!elements.length) {
        return;
    }

    /*
     * If IntersectionObserver is unavailable,
     * content should remain visible.
     */
    if (!("IntersectionObserver" in window)) {
        elements.forEach(element => {
            element.classList.add(
                "is-visible"
            );
        });

        return;
    }

    const observer =
        new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.classList.add(
                        "is-visible"
                    );

                    observer.unobserve(
                        entry.target
                    );
                });
            },
            {
                threshold: 0.08,
                rootMargin: "0px 0px -40px 0px"
            }
        );

    elements.forEach(element => {
        observer.observe(element);
    });
}