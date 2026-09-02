"use strict";


/*
 * Difurrent
 * Minimal interaction layer.
 *
 * No libraries.
 * No framework.
 * No continuous animation.
 */


document.addEventListener("DOMContentLoaded", () => {
  setupMobileNavigation();
  setupProjectDialog();
});


/* --------------------------------------------------
   MOBILE NAVIGATION
-------------------------------------------------- */

function setupMobileNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");

  if (!toggle || !mobileNav) {
    return;
  }

  const mobileLinks = mobileNav.querySelectorAll("a");

  function setMenu(open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation"
    );

    mobileNav.classList.toggle("is-open", open);
    mobileNav.setAttribute("aria-hidden", String(!open));

    document.body.classList.toggle("nav-open", open);
  }

  toggle.addEventListener("click", () => {
    const isOpen =
      toggle.getAttribute("aria-expanded") === "true";

    setMenu(!isOpen);
  });

  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setMenu(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenu(false);
    }
  });
}


/* --------------------------------------------------
   PROJECT DIALOG
-------------------------------------------------- */

function setupProjectDialog() {
  const dialog = document.querySelector(".project-dialog");
  const trigger = document.querySelector(
    ".project-dialog-trigger"
  );

  if (!dialog || !trigger) {
    return;
  }

  const closeButtons = dialog.querySelectorAll(
    ".dialog-close, .dialog-close-button"
  );

  trigger.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      dialog.close();
    });
  });

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();

    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedOutside) {
      dialog.close();
    }
  });
}