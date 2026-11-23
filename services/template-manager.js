/**
 * Magic Mail - Shared Master-Detail Template Manager Controller
 * Powers the Template Manager UI in both Settings and Compose Popup.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

(function () {
  class TemplateManager {
    /**
     * @param {Object} options
     * @param {'options' | 'compose'} [options.mode='options']
     * @param {(tpl: Object) => Promise<void>} [options.onUse]
     * @param {(msg: string, type?: string) => void} [options.onNotify]
     */
    constructor({ mode = 'options', onUse, onNotify } = {}) {
      this.mode = mode;
      this.onUse = onUse;
      this.onNotify = onNotify || (() => {});

      this.allTemplates = [];
      this.selectedTemplateId = null;
      this.categoryFilter = 'All';
      this.searchQuery = '';
      this.isEditing = false;

      this.cacheElements();
      this.bindEvents();
    }

    cacheElements() {
      this.searchInput = document.getElementById('templateSearchInput');
      this.categorySelect = document.getElementById('templateCategoryFilters');
      this.newBtn = document.getElementById('toggleTemplateEditorBtn');
      this.restoreBtn = document.getElementById('restoreDefaultTemplatesBtn');
      this.countBadge = document.getElementById('templatesCountBadge');
      this.listEl = document.getElementById('templatesList');

      this.detailView = document.getElementById('templateDetailView');
      this.detailTitle = document.getElementById('detailTemplateTitle');
      this.detailCategory = document.getElementById('detailTemplateCategory');
      this.detailBody = document.getElementById('detailTemplateBody');
      this.editBtn = document.getElementById('detailEditTemplateBtn');
      this.deleteBtn = document.getElementById('detailDeleteTemplateBtn');
      this.deleteConfirmBar = document.getElementById('detailDeleteConfirmBar');
      this.cancelDeleteBtn = document.getElementById('detailCancelDeleteBtn');
      this.confirmDeleteBtn = document.getElementById('detailConfirmDeleteBtn');
      this.primaryUseBtn = document.getElementById('detailPrimaryUseBtn');
      this.primaryUseLabel = document.getElementById('detailPrimaryUseLabel');

      this.editorCard = document.getElementById('templateEditorCard');
      this.editorHeading = document.getElementById('templateEditorHeading');
      this.editingIdInput = document.getElementById('editingTemplateId');
      this.titleInput = document.getElementById('newTemplateTitle');
      this.categoryInput = document.getElementById('newTemplateCategory');
      this.bodyInput = document.getElementById('newTemplateBody');
      this.cancelEditBtn = document.getElementById('cancelTemplateEditBtn');
      this.saveBtn = document.getElementById('saveNewTemplateBtn');
      this.saveBtnLabel = document.getElementById('saveTemplateBtnLabel');

      this.emptyView = document.getElementById('templateEmptyView');
      this.emptyMessage = document.getElementById('templateEmptyMessage');
      this.emptyCreateBtn = document.getElementById('emptyCreateTemplateBtn');
    }

    bindEvents() {
      if (this.searchInput) {
        this.searchInput.addEventListener('input', () => {
          this.searchQuery = this.searchInput.value;
          this.renderFiltered();
        });
      }

      if (this.categorySelect) {
        this.categorySelect.addEventListener('change', () => {
          this.categoryFilter = this.categorySelect.value || 'All';
          this.renderFiltered();
        });
      }

      if (this.newBtn) {
        this.newBtn.addEventListener('click', () => this.openEditor(null));
      }

      if (this.emptyCreateBtn) {
        this.emptyCreateBtn.addEventListener('click', () => this.openEditor(null));
      }

      if (this.cancelEditBtn) {
        this.cancelEditBtn.addEventListener('click', () => this.closeEditor());
      }

      if (this.saveBtn) {
        this.saveBtn.addEventListener('click', () => this.saveCurrentTemplate());
      }

      if (this.editBtn) {
        this.editBtn.addEventListener('click', () => {
          const tpl = this.getSelectedTemplate();
          if (tpl) this.openEditor(tpl);
        });
      }

      if (this.deleteBtn && this.deleteConfirmBar) {
        this.deleteBtn.addEventListener('click', () => {
          this.deleteConfirmBar.classList.toggle('hidden');
        });
      }

      if (this.cancelDeleteBtn && this.deleteConfirmBar) {
        this.cancelDeleteBtn.addEventListener('click', () => {
          this.deleteConfirmBar.classList.add('hidden');
        });
      }

      if (this.confirmDeleteBtn) {
        this.confirmDeleteBtn.addEventListener('click', async () => {
          const tpl = this.getSelectedTemplate();
          if (!tpl) return;
          this.selectedTemplateId = null;
          await StorageService.deleteTemplate(tpl.id);
          await this.refresh();
          this.onNotify(`Deleted template "${tpl.title}".`, 'info');
        });
      }

      if (this.restoreBtn) {
        this.restoreBtn.addEventListener('click', async () => {
          await StorageService.restoreDefaultTemplates();
          await this.refresh();
          this.onNotify('Built-in templates restored.', 'success');
        });
      }

      if (this.primaryUseBtn) {
        this.primaryUseBtn.addEventListener('click', async () => {
          const tpl = this.getSelectedTemplate();
          if (tpl && typeof this.onUse === 'function') {
            await this.onUse(tpl);
          }
        });
      }
    }

    getSelectedTemplate() {
      return this.allTemplates.find(t => t.id === this.selectedTemplateId) || null;
    }

    setRightPaneMode(mode) {
      if (this.detailView) this.detailView.classList.toggle('hidden', mode !== 'detail');
      if (this.editorCard) this.editorCard.classList.toggle('hidden', mode !== 'editor');
      if (this.emptyView) this.emptyView.classList.toggle('hidden', mode !== 'empty');
    }

    openEditor(template = null) {
      this.isEditing = true;
      this.setRightPaneMode('editor');

      if (template) {
        this.editingIdInput.value = template.id;
        if (this.editorHeading) this.editorHeading.textContent = 'Edit Template';
        if (this.saveBtnLabel) this.saveBtnLabel.textContent = 'Update Template';
        this.titleInput.value = template.title || '';
        this.bodyInput.value = template.content || '';
        const catVal = template.category || 'General';
        if (this.categoryInput) {
          if (!Array.from(this.categoryInput.options).some(o => o.value === catVal)) {
            const opt = document.createElement('option');
            opt.value = catVal;
            opt.textContent = catVal;
            this.categoryInput.appendChild(opt);
          }
          this.categoryInput.value = catVal;
        }
      } else {
        this.editingIdInput.value = '';
        if (this.editorHeading) this.editorHeading.textContent = 'New Template';
        if (this.saveBtnLabel) this.saveBtnLabel.textContent = 'Save Template';
        this.titleInput.value = '';
        this.bodyInput.value = '';
        if (this.categoryInput) this.categoryInput.value = 'General';
      }

      if (this.titleInput) this.titleInput.focus();
    }

    closeEditor() {
      this.isEditing = false;
      if (this.editingIdInput) this.editingIdInput.value = '';
      if (this.titleInput) this.titleInput.value = '';
      if (this.bodyInput) this.bodyInput.value = '';
      if (this.categoryInput) this.categoryInput.value = 'General';
      this.renderDetailPane();
    }

    async saveCurrentTemplate() {
      const title = (this.titleInput.value || '').trim();
      const content = (this.bodyInput.value || '').trim();
      const category = (this.categoryInput && this.categoryInput.value) || 'General';
      const existingId = this.editingIdInput ? this.editingIdInput.value : '';

      if (!title || !content) {
        this.onNotify('Please provide both template title and content.', 'warning');
        return;
      }

      const saved = await StorageService.saveTemplate({
        id: existingId || undefined,
        title,
        category,
        content
      });

      this.isEditing = false;
      this.selectedTemplateId = saved.id;
      await this.refresh();
      this.onNotify(existingId ? 'Template updated.' : 'Template saved.', 'success');
    }

    renderCategoryFilters(templates) {
      if (!this.categorySelect) return;
      const categories = ['All', ...new Set(templates.map(t => t.category || 'General'))];
      if (!categories.includes(this.categoryFilter)) {
        this.categoryFilter = 'All';
      }
      this.categorySelect.innerHTML = '';
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat === 'All' ? 'All Categories' : cat;
        if (cat === this.categoryFilter) opt.selected = true;
        this.categorySelect.appendChild(opt);
      });
      this.categorySelect.value = this.categoryFilter;
    }

    renderDetailPane() {
      if (this.isEditing) {
        this.setRightPaneMode('editor');
        return;
      }

      const tpl = this.getSelectedTemplate();
      if (!tpl) {
        this.setRightPaneMode('empty');
        if (this.emptyMessage) {
          this.emptyMessage.textContent = this.allTemplates.length === 0
            ? 'No saved templates yet. Create your first email template.'
            : 'No matching template selected.';
        }
        return;
      }

      this.setRightPaneMode('detail');
      if (this.deleteConfirmBar) this.deleteConfirmBar.classList.add('hidden');
      if (this.detailTitle) this.detailTitle.textContent = tpl.title;
      if (this.detailCategory) this.detailCategory.textContent = tpl.category || 'General';
      UIHelpers.renderColorizedTemplateBody(this.detailBody, tpl.content || '');

      if (this.primaryUseBtn) {
        const showUseBtn = typeof this.onUse === 'function';
        this.primaryUseBtn.classList.toggle('hidden', !showUseBtn);
        if (this.primaryUseLabel) {
          this.primaryUseLabel.textContent = this.mode === 'compose' ? 'Insert in Current Mail' : 'Use in New Email';
        }
      }
    }

    renderFiltered() {
      const query = this.searchQuery.trim().toLowerCase();
      const filtered = this.allTemplates.filter(tpl => {
        const cat = tpl.category || 'General';
        if (this.categoryFilter !== 'All' && cat !== this.categoryFilter) return false;
        if (!query) return true;
        return (tpl.title || '').toLowerCase().includes(query) ||
          cat.toLowerCase().includes(query) ||
          (tpl.content || '').toLowerCase().includes(query);
      });

      const total = this.allTemplates.length;
      if (this.countBadge) {
        this.countBadge.textContent = (query || this.categoryFilter !== 'All')
          ? `${filtered.length}/${total}`
          : `${total}`;
      }

      if (filtered.length > 0 && !filtered.some(t => t.id === this.selectedTemplateId)) {
        this.selectedTemplateId = filtered[0].id;
      } else if (filtered.length === 0) {
        this.selectedTemplateId = null;
      }

      if (!this.listEl) return;
      this.listEl.innerHTML = '';

      if (filtered.length === 0) {
        const emptyNav = document.createElement('div');
        emptyNav.className = 'templates-nav-empty';
        emptyNav.textContent = total === 0 ? 'No templates yet.' : 'No matches found.';
        this.listEl.appendChild(emptyNav);
        this.renderDetailPane();
        return;
      }

      filtered.forEach(tpl => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'template-nav-item' + (tpl.id === this.selectedTemplateId ? ' active' : '');

        const titleEl = document.createElement('span');
        titleEl.className = 'template-nav-title';
        titleEl.textContent = tpl.title;

        const metaEl = document.createElement('span');
        metaEl.className = 'template-nav-meta';
        metaEl.textContent = tpl.category || 'General';

        btn.appendChild(titleEl);
        btn.appendChild(metaEl);

        btn.addEventListener('click', () => {
          this.selectedTemplateId = tpl.id;
          this.isEditing = false;
          this.renderFiltered();
        });

        this.listEl.appendChild(btn);
      });

      this.renderDetailPane();
    }

    async refresh() {
      const [templates, hasDeletedDefaults] = await Promise.all([
        StorageService.getTemplates(),
        StorageService.hasDeletedDefaultTemplates()
      ]);

      this.allTemplates = templates;
      if (this.restoreBtn) {
        this.restoreBtn.classList.toggle('hidden', !hasDeletedDefaults);
      }

      this.renderCategoryFilters(templates);
      this.renderFiltered();
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.TemplateManager = TemplateManager;
  }
  if (typeof window !== 'undefined') {
    window.TemplateManager = TemplateManager;
  }
})();
