/* ==========================================================================
   Magic Mail - Shared UI Helpers
   Reusable UI utilities for theme switching, alerts, escaping, and copy actions.
   Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
   ========================================================================== */

(function () {
  const THEME_ICONS = {
    moon: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
  };

  class UIHelpers {
    /**
     * Applies 'light', 'dark', or 'system' theme to document.body (defaults to 'light').
     * @param {string} theme
     * @returns {'light' | 'dark'}
     */
    static applyTheme(theme) {
      if (typeof document === 'undefined' || !document.body) return 'light';
      const targetTheme = theme || 'light';
      let effective = 'light';
      if (targetTheme === 'system') {
        const prefersDark = typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        effective = prefersDark ? 'dark' : 'light';
      } else {
        effective = targetTheme === 'dark' ? 'dark' : 'light';
      }
      document.body.setAttribute('data-theme', effective);
      return effective;
    }

    /**
     * Updates a theme toggle icon container to reflect the current effective theme.
     * @param {HTMLElement | null} iconEl
     * @param {string} effectiveTheme
     */
    static syncThemeIcon(iconEl, effectiveTheme) {
      if (!iconEl) return;
      iconEl.innerHTML = effectiveTheme === 'dark' ? THEME_ICONS.sun : THEME_ICONS.moon;
    }

    /**
     * Escapes HTML special characters for safe DOM rendering.
     * @param {string} value
     * @returns {string}
     */
    static escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /**
     * Renders template text into a container with highlighted [Placeholder] chips.
     * @param {HTMLElement | null} container
     * @param {string} body
     */
    static renderColorizedTemplateBody(container, body) {
      if (!container) return;
      container.innerHTML = '';
      const text = String(body || '');
      const parts = text.split(/(\[[^\[\]\n]+\])/g);
      parts.forEach(part => {
        if (/^\[[^\[\]\n]+\]$/.test(part)) {
          const span = document.createElement('span');
          span.className = 'tpl-placeholder-chip';
          span.textContent = part;
          container.appendChild(span);
        } else if (part) {
          container.appendChild(document.createTextNode(part));
        }
      });
    }

    /**
     * Wires copy buttons with data-copy attributes inside a root element.
     * @param {ParentNode} root
     * @param {(msg: string) => void} [onCopied]
     */
    static wireCopyButtons(root = document, onCopied) {
      if (!root) return;
      root.querySelectorAll('.support-copy-btn[data-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const text = btn.dataset.copy;
          const labelEl = btn.querySelector('.copy-btn-label');
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
            }
            if (labelEl) {
              const prev = labelEl.textContent;
              labelEl.textContent = 'Copied';
              setTimeout(() => {
                labelEl.textContent = prev;
              }, 1600);
            }
            if (typeof onCopied === 'function') {
              onCopied(`Copied ${btn.dataset.copyLabel || 'value'}.`);
            }
          } catch (err) {
            console.warn('UIHelpers: clipboard copy failed', err);
          }
        });
      });
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.UIHelpers = UIHelpers;
  }
  if (typeof window !== 'undefined') {
    window.UIHelpers = UIHelpers;
  }
})();
