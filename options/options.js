/**
 * Magic Mail - Settings Page Controller
 * Manages tab navigation, extension toggles, Master-Detail Template Manager,
 * import/export, and theme switching.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

const SETTINGS_SVG_ICONS = {
  info: '<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  success: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  warning: '<svg class="icon-svg" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  danger: '<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
};

document.addEventListener('DOMContentLoaded', async () => {
  const api = StorageService.getApi();
  let settings = await StorageService.getSettings();
  let alertTimer = null;

  const themeToggle = document.getElementById('settingsThemeToggle');
  const themeIcon = document.getElementById('themeToggleIcon');
  const alertEl = document.getElementById('settingsAlert');
  const alertMsg = document.getElementById('settingsAlertMsg');
  const alertIcon = document.getElementById('settingsAlertIcon');

  const tabButtons = document.querySelectorAll('.settings-tabs-nav .tab-btn');
  const tabPanes = document.querySelectorAll('.settings-stack .tab-pane');

  const autoAttachCheckbox = document.getElementById('autoAttach');
  const mailSchedulingCheckbox = document.getElementById('mailScheduling');
  const notifySuccessCheckbox = document.getElementById('notifySuccess');
  const quickTemplateCheckbox = document.getElementById('quickTemplate');
  const debugLogsCheckbox = document.getElementById('debugLogs');

  const quickTemplateNotice = document.getElementById('quickTemplateDisabledNotice');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFileInput = document.getElementById('importFile');

  function showAlert(message, type = 'success') {
    if (!alertEl || !alertMsg) return;
    if (alertTimer) clearTimeout(alertTimer);
    alertEl.className = `alert alert-${type}`;
    if (alertIcon) {
      alertIcon.innerHTML = SETTINGS_SVG_ICONS[type] || SETTINGS_SVG_ICONS.success;
    }
    alertMsg.textContent = message;
    alertTimer = setTimeout(() => {
      alertEl.classList.add('hidden');
    }, 2600);
  }

  function syncTheme() {
    const effective = UIHelpers.applyTheme(settings.theme || 'light');
    UIHelpers.syncThemeIcon(themeIcon, effective);
  }

  function syncQuickTemplateNotice(enabled) {
    if (!quickTemplateNotice) return;
    quickTemplateNotice.classList.toggle('hidden', Boolean(enabled));
  }

  function switchTab(targetId) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetId);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === targetId);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const templateManager = new TemplateManager({
    mode: 'options',
    onUse: async (tpl) => {
      if (api && api.compose && api.compose.beginNew) {
        const details = StorageService.sanitizeComposeDetails({
          subject: tpl.title,
          plainTextBody: tpl.content,
          isHTML: false
        });
        await api.compose.beginNew(details);
        showAlert(`Opened template "${tpl.title}" in new email draft.`, 'success');
      }
    },
    onNotify: (msg, type) => showAlert(msg, type)
  });

  async function saveToggleSettings() {
    const partial = {
      autoAttach: autoAttachCheckbox.checked,
      mailScheduling: mailSchedulingCheckbox.checked,
      notifySuccess: notifySuccessCheckbox.checked,
      quickTemplate: quickTemplateCheckbox.checked,
      debugLogs: debugLogsCheckbox.checked
    };

    await StorageService.saveSettings(partial);
    settings = { ...settings, ...partial };
    syncQuickTemplateNotice(partial.quickTemplate);
    showAlert('Settings saved.', 'success');
  }

  async function exportTemplates() {
    const templates = await StorageService.getTemplates();
    const data = {
      app: 'Magic Mail',
      version: '1.1',
      exportDate: new Date().toISOString(),
      templates
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `magic-mail-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTemplates(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        let imported;

        if (Array.isArray(data)) {
          imported = data;
        } else if (data.templates && Array.isArray(data.templates)) {
          imported = data.templates;
        } else {
          throw new Error('Invalid template file format');
        }

        let count = 0;
        for (const tpl of imported) {
          const content = tpl.content !== undefined ? tpl.content : tpl.body;
          if (tpl.title && content) {
            await StorageService.saveTemplate({
              id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              title: tpl.title,
              category: tpl.category || 'General',
              content
            });
            count++;
          }
        }

        await templateManager.refresh();
        showAlert(`Successfully imported ${count} template(s).`, 'success');
        event.target.value = '';
      } catch (err) {
        console.error('Magic Mail: template import failed:', err);
        showAlert('Failed to import templates. Please check the JSON format.', 'danger');
      }
    };
    reader.readAsText(file);
  }

  // Hydrate initial UI
  syncTheme();
  autoAttachCheckbox.checked = Boolean(settings.autoAttach);
  mailSchedulingCheckbox.checked = Boolean(settings.mailScheduling);
  notifySuccessCheckbox.checked = Boolean(settings.notifySuccess);
  quickTemplateCheckbox.checked = Boolean(settings.quickTemplate);
  debugLogsCheckbox.checked = Boolean(settings.debugLogs);

  syncQuickTemplateNotice(settings.quickTemplate);
  await templateManager.refresh();

  [
    autoAttachCheckbox,
    mailSchedulingCheckbox,
    notifySuccessCheckbox,
    quickTemplateCheckbox,
    debugLogsCheckbox
  ].forEach(checkbox => {
    if (checkbox) checkbox.addEventListener('change', saveToggleSettings);
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      const current = document.body.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      settings.theme = next;
      await StorageService.saveSettings({ theme: next });
      syncTheme();
    });
  }

  if (exportBtn) exportBtn.addEventListener('click', exportTemplates);
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importTemplates);
  }

  UIHelpers.wireCopyButtons(document, (msg) => showAlert(msg, 'success'));
});
