/**
 * Magic Mail - Compose Action Popup Controller
 * Handles Schedule Send and Master-Detail Quick Template insertion in compose windows.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

document.addEventListener('DOMContentLoaded', async () => {
  const api = StorageService.getApi();
  const settings = await StorageService.getSettings();

  UIHelpers.applyTheme(settings.theme || 'light');

  const tabsContainer = document.getElementById('tabsContainer');
  const scheduleTabBtn = document.querySelector(".tab-btn[data-tab='scheduleTab']");
  const templateTabBtn = document.querySelector(".tab-btn[data-tab='templateTab']");
  const schedulePane = document.getElementById('scheduleTab');
  const templatePane = document.getElementById('templateTab');
  const contentArea = document.getElementById('contentArea');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const composeAlert = document.getElementById('composeAlert');
  const featureFootnote = document.getElementById('composeFeatureFootnote');
  const footnoteText = document.getElementById('composeFootnoteText');
  const footnoteSettingsBtn = document.getElementById('composeFootnoteSettingsBtn');

  function showComposeAlert(message, type = 'info') {
    if (!composeAlert) return;
    composeAlert.textContent = message;
    composeAlert.className = `alert alert-${type}`;
    setTimeout(() => {
      composeAlert.classList.add('hidden');
    }, 2400);
  }

  function openSettings() {
    if (api && api.runtime && api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    }
  }

  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);
  if (footnoteSettingsBtn) footnoteSettingsBtn.addEventListener('click', openSettings);

  // Show a small non-destructive footnote if a compose feature is turned off
  if (featureFootnote && footnoteText) {
    const disabledFeatures = [];
    if (!settings.quickTemplate) disabledFeatures.push('Quick Templates');
    if (!settings.mailScheduling) disabledFeatures.push('Mail Scheduling');

    if (disabledFeatures.length === 1) {
      footnoteText.textContent = `${disabledFeatures[0]} is off. Enable it anytime in Settings.`;
      featureFootnote.classList.remove('hidden');
    }
  }

  // Handle visibility of tabs based on enabled features
  if (!settings.mailScheduling) {
    if (scheduleTabBtn) scheduleTabBtn.classList.add('hidden');
    if (schedulePane) schedulePane.classList.remove('active');
  }

  if (!settings.quickTemplate) {
    if (templateTabBtn) templateTabBtn.classList.add('hidden');
    if (templatePane) templatePane.classList.remove('active');
  }

  // Determine default active tab (Templates first, then Schedule)
  if (settings.quickTemplate) {
    if (templateTabBtn) templateTabBtn.classList.add('active');
    if (templatePane) templatePane.classList.add('active');
    if (scheduleTabBtn) scheduleTabBtn.classList.remove('active');
    if (schedulePane) schedulePane.classList.remove('active');
    setTimeout(() => {
      const search = document.getElementById('templateSearchInput');
      if (search) search.focus();
    }, 100);
  } else if (settings.mailScheduling) {
    if (scheduleTabBtn) scheduleTabBtn.classList.add('active');
    if (schedulePane) schedulePane.classList.add('active');
    if (templateTabBtn) templateTabBtn.classList.remove('active');
    if (templatePane) templatePane.classList.remove('active');
  }

  if (tabsContainer && (!settings.mailScheduling || !settings.quickTemplate)) {
    tabsContainer.classList.add('hidden');
  }

  if (!settings.mailScheduling && !settings.quickTemplate && contentArea) {
    contentArea.innerHTML = `
      <div class="card empty-state">
        <h3>No Compose Features Enabled</h3>
        <p style="margin-bottom: 12px;">Enable Mail Scheduling or Quick Templates in Magic Mail settings.</p>
        <button type="button" class="btn-primary btn-sm" id="emptyOpenSettingsBtn">Open Settings</button>
      </div>
    `;
    const emptySettingsBtn = document.getElementById('emptyOpenSettingsBtn');
    if (emptySettingsBtn) emptySettingsBtn.addEventListener('click', openSettings);
    return;
  }

  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');

      if (btn.dataset.tab === 'templateTab') {
        const search = document.getElementById('templateSearchInput');
        if (search) search.focus();
      }
    });
  });

  // --- Schedule Feature ---
  if (settings.mailScheduling) {
    const timeInput = document.getElementById('scheduleTime');
    const recurrenceSelect = document.getElementById('scheduleRecurrence');
    const scheduleBtn = document.getElementById('scheduleBtn');
    const scheduleStatus = document.getElementById('status');

    function showScheduleStatus(message, type) {
      if (!scheduleStatus) return;
      scheduleStatus.textContent = message;
      scheduleStatus.className = `alert alert-${type}`;
    }

    if (timeInput) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      timeInput.value = localNow;
    }

    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', async () => {
        const scheduledTime = new Date(timeInput.value).getTime();
        const recurrence = (recurrenceSelect && recurrenceSelect.value) || 'none';
        if (!scheduledTime || scheduledTime <= Date.now()) {
          showScheduleStatus('Please pick a future date and time.', 'danger');
          return;
        }

        try {
          const [tab] = await api.tabs.query({ active: true, currentWindow: true });
          const rawDetails = await api.compose.getComposeDetails(tab.id);
          const hasRecipients =
            (Array.isArray(rawDetails.to) && rawDetails.to.length > 0) ||
            (Array.isArray(rawDetails.cc) && rawDetails.cc.length > 0) ||
            (Array.isArray(rawDetails.bcc) && rawDetails.bcc.length > 0);

          if (!hasRecipients) {
            showScheduleStatus('Please add at least one recipient (To, Cc, or Bcc).', 'danger');
            return;
          }

          const composeAttachments = await api.compose.listAttachments(tab.id);
          const attachments = [];

          for (const att of composeAttachments || []) {
            const file = await api.compose.getAttachmentFile(att.id);
            if (file) {
              attachments.push({
                file,
                name: att.name || file.name
              });
            }
          }

          const details = StorageService.sanitizeComposeDetails({
            ...rawDetails,
            attachments
          });

          const messageData = {
            id: `msg_${Date.now()}`,
            scheduledTime,
            recurrence,
            paused: false,
            details,
            tabId: tab.id
          };

          const scheduledMessages = await StorageService.getScheduledMessages();
          scheduledMessages.push(messageData);
          await StorageService.saveScheduledMessages(scheduledMessages);

          api.alarms.create(messageData.id, { when: scheduledTime });

          const label = recurrence === 'none'
            ? 'Message scheduled successfully.'
            : `Recurring (${recurrence}) message scheduled.`;
          showScheduleStatus(label, 'success');
          scheduleBtn.disabled = true;

          setTimeout(() => {
            api.tabs.remove(tab.id);
            window.close();
          }, 1000);
        } catch (err) {
          console.error('Magic Mail: schedule failed:', err);
          showScheduleStatus(`Error: ${err.message}`, 'danger');
        }
      });
    }
  }

  // --- Template Feature (Master-Detail Workspace) ---
  if (settings.quickTemplate) {
    async function insertTemplate(content) {
      try {
        const [activeTab] = await api.tabs.query({ active: true, currentWindow: true });
        const response = await api.runtime.sendMessage({
          action: 'insertTemplateAtCursor',
          tabId: activeTab ? activeTab.id : undefined,
          content
        });

        if (response && response.success) {
          window.close();
          return;
        }

        if (activeTab) {
          await api.compose.insertText(activeTab.id, content);
          window.close();
        }
      } catch (err) {
        console.error('Magic Mail: template insertion failed:', err);
        showComposeAlert(`Insertion failed: ${err.message}`, 'danger');
      }
    }

    const templateManager = new TemplateManager({
      mode: 'compose',
      onUse: async (tpl) => {
        await insertTemplate(tpl.content);
      },
      onNotify: (msg, type) => showComposeAlert(msg, type)
    });

    await templateManager.refresh();
  }
});
