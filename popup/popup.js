/**
 * Magic Mail - Browser Action Popup Controller
 * Manages quick Auto-Attach toggle, feature badges, theme switching,
 * upcoming scheduled/recurring messages, and delivery history log.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

document.addEventListener('DOMContentLoaded', async () => {
  const api = StorageService.getApi();

  const autoAttachBadge = document.getElementById('autoAttachBadge');
  const schedulingBadge = document.getElementById('schedulingBadge');
  const templatesBadge = document.getElementById('templatesBadge');

  const upcomingTabBtn = document.getElementById('upcomingTabBtn');
  const historyTabBtn = document.getElementById('historyTabBtn');
  const upcomingPane = document.getElementById('upcomingPane');
  const historyPane = document.getElementById('historyPane');

  const scheduledCountBadge = document.getElementById('scheduledCountBadge');
  const historyCountBadge = document.getElementById('historyCountBadge');
  const scheduledList = document.getElementById('scheduledList');
  const historyToolbar = document.getElementById('historyToolbar');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const popupAlert = document.getElementById('popupAlert');

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const headerSettingsBtn = document.getElementById('headerSettingsBtn');

  let settings = await StorageService.getSettings();
  let editingScheduledId = null;
  let reschedulingHistoryId = null;

  function syncTheme() {
    const effective = UIHelpers.applyTheme(settings.theme || 'light');
    UIHelpers.syncThemeIcon(themeToggleIcon, effective);
  }

  function showPopupAlert(message, type = 'danger') {
    if (!popupAlert) return;
    popupAlert.textContent = message;
    popupAlert.className = `alert alert-${type}`;
    setTimeout(() => {
      popupAlert.classList.add('hidden');
    }, 2500);
  }

  function updateAutoAttachUI(isActive) {
    updateFeatureBadge(autoAttachBadge, isActive);
  }

  function updateFeatureBadge(el, enabled) {
    if (!el) return;
    el.textContent = enabled ? 'Active' : 'Off';
    el.className = enabled ? 'badge badge-success' : 'badge badge-primary';
  }

  function toLocalDatetimeValue(timestamp) {
    const d = new Date(timestamp);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  function switchScheduledSubTab(tab) {
    const showHistory = tab === 'history';
    if (upcomingTabBtn) upcomingTabBtn.classList.toggle('active', !showHistory);
    if (historyTabBtn) historyTabBtn.classList.toggle('active', showHistory);
    if (upcomingPane) upcomingPane.classList.toggle('hidden', showHistory);
    if (historyPane) historyPane.classList.toggle('hidden', !showHistory);
  }

  if (upcomingTabBtn) {
    upcomingTabBtn.addEventListener('click', () => switchScheduledSubTab('upcoming'));
  }
  if (historyTabBtn) {
    historyTabBtn.addEventListener('click', () => switchScheduledSubTab('history'));
  }

  async function removeScheduledMessage(id) {
    try {
      if (api && api.alarms && api.alarms.clear) {
        await api.alarms.clear(id);
      }
      const list = await StorageService.getScheduledMessages();
      const updated = list.filter(m => m.id !== id);
      await StorageService.saveScheduledMessages(updated);
      if (editingScheduledId === id) editingScheduledId = null;
      await renderScheduledMessages(updated);
    } catch (err) {
      console.error('Magic Mail: failed to remove scheduled message:', err);
      showPopupAlert(`Failed to remove: ${err.message}`);
    }
  }

  async function togglePauseMessage(id) {
    try {
      const list = await StorageService.getScheduledMessages();
      const index = list.findIndex(m => m.id === id);
      if (index === -1) return;

      const msg = list[index];
      const nextPaused = !msg.paused;
      msg.paused = nextPaused;

      if (nextPaused) {
        if (api && api.alarms && api.alarms.clear) {
          await api.alarms.clear(id);
        }
      } else {
        if (msg.scheduledTime <= Date.now()) {
          const nextTime = StorageService.computeNextOccurrence(msg.scheduledTime, msg.recurrence);
          if (nextTime) msg.scheduledTime = nextTime;
        }
        if (api && api.alarms && msg.scheduledTime > Date.now()) {
          api.alarms.create(id, { when: msg.scheduledTime });
        }
      }

      await StorageService.saveScheduledMessages(list);
      await renderScheduledMessages(list);
    } catch (err) {
      console.error('Magic Mail: failed to toggle pause:', err);
      showPopupAlert(`Failed to update: ${err.message}`);
    }
  }

  async function rescheduleMessage(id, newTimeValue, newRecurrence) {
    const newTimestamp = new Date(newTimeValue).getTime();
    if (!newTimestamp || newTimestamp <= Date.now()) {
      showPopupAlert('Please select a future date and time.');
      return;
    }

    try {
      const list = await StorageService.getScheduledMessages();
      const index = list.findIndex(m => m.id === id);
      if (index === -1) return;

      list[index].scheduledTime = newTimestamp;
      list[index].recurrence = newRecurrence || 'none';
      if (list[index].recurrence === 'none') {
        list[index].paused = false;
      }
      await StorageService.saveScheduledMessages(list);

      if (api && api.alarms) {
        if (api.alarms.clear) await api.alarms.clear(id);
        if (!list[index].paused) {
          api.alarms.create(id, { when: newTimestamp });
        }
      }

      editingScheduledId = null;
      await renderScheduledMessages(list);
    } catch (err) {
      console.error('Magic Mail: failed to reschedule message:', err);
      showPopupAlert(`Failed to reschedule: ${err.message}`);
    }
  }

  async function scheduleFromHistory(entry, newTimeValue) {
    const newTimestamp = new Date(newTimeValue).getTime();
    if (!newTimestamp || newTimestamp <= Date.now()) {
      showPopupAlert('Please select a future date and time.');
      return;
    }

    try {
      const list = await StorageService.getScheduledMessages();
      const messageData = {
        id: `msg_${Date.now()}`,
        scheduledTime: newTimestamp,
        recurrence: 'none',
        paused: false,
        details: StorageService.sanitizeComposeDetails(entry.details)
      };
      list.push(messageData);
      await StorageService.saveScheduledMessages(list);

      if (api && api.alarms) {
        api.alarms.create(messageData.id, { when: newTimestamp });
      }

      reschedulingHistoryId = null;
      await renderScheduledMessages(list);
      switchScheduledSubTab('upcoming');
      showPopupAlert('Message scheduled again.', 'success');
    } catch (err) {
      console.error('Magic Mail: failed to schedule from history:', err);
      showPopupAlert(`Failed to schedule: ${err.message}`);
    }
  }

  async function openHistoryDraft(entry) {
    try {
      if (api && api.compose && api.compose.beginNew) {
        const details = StorageService.sanitizeComposeDetails(entry.details);
        await api.compose.beginNew(details);
        window.close();
      }
    } catch (err) {
      console.error('Magic Mail: failed to open draft from history:', err);
      showPopupAlert(`Failed to open draft: ${err.message}`);
    }
  }

  async function renderScheduledMessages(messagesArg) {
    if (!scheduledList) return;
    const messages = Array.isArray(messagesArg)
      ? messagesArg
      : await StorageService.getScheduledMessages();

    const sorted = [...messages].sort((a, b) => a.scheduledTime - b.scheduledTime);

    if (scheduledCountBadge) {
      scheduledCountBadge.textContent = String(sorted.length);
    }

    scheduledList.innerHTML = '';

    if (sorted.length === 0) {
      scheduledList.innerHTML = '<div class="empty-scheduled">No scheduled messages.</div>';
      return;
    }

    sorted.forEach(msg => {
      const details = msg.details || {};
      const recurrence = msg.recurrence || 'none';
      const isRecurring = recurrence !== 'none';
      const item = document.createElement('div');
      item.className = 'scheduled-item';

      const topRow = document.createElement('div');
      topRow.className = 'scheduled-item-top';

      const info = document.createElement('div');
      info.className = 'scheduled-item-info';

      const subjectEl = document.createElement('div');
      subjectEl.className = 'scheduled-subject';
      subjectEl.textContent = details.subject || '(No Subject)';

      const toList = Array.isArray(details.to) ? details.to.join(', ') : '';
      const metaEl = document.createElement('div');
      metaEl.className = 'scheduled-meta';
      metaEl.textContent = toList ? `To: ${toList}` : 'No recipients';

      info.appendChild(subjectEl);
      info.appendChild(metaEl);
      topRow.appendChild(info);

      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'scheduled-badges';

      if (isRecurring) {
        const recBadge = document.createElement('span');
        recBadge.className = msg.paused ? 'badge badge-warning' : 'badge badge-success';
        recBadge.textContent = msg.paused ? `${recurrence} (paused)` : recurrence;
        badgesWrap.appendChild(recBadge);
      }

      const attCount = Array.isArray(details.attachments) ? details.attachments.length : 0;
      if (attCount > 0) {
        const attBadge = document.createElement('span');
        attBadge.className = 'badge badge-primary';
        attBadge.textContent = `${attCount} file${attCount > 1 ? 's' : ''}`;
        badgesWrap.appendChild(attBadge);
      }

      if (badgesWrap.children.length > 0) {
        topRow.appendChild(badgesWrap);
      }

      const timeRow = document.createElement('div');
      timeRow.className = 'scheduled-time-row';

      const timeEl = document.createElement('span');
      timeEl.className = 'scheduled-time';
      timeEl.textContent = new Date(msg.scheduledTime).toLocaleString();

      const actions = document.createElement('div');
      actions.className = 'scheduled-actions';

      if (isRecurring) {
        const pauseBtn = document.createElement('button');
        pauseBtn.type = 'button';
        pauseBtn.className = 'btn-secondary btn-sm';
        pauseBtn.textContent = msg.paused ? 'Resume' : 'Pause';
        pauseBtn.addEventListener('click', () => togglePauseMessage(msg.id));
        actions.appendChild(pauseBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-secondary btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        editingScheduledId = editingScheduledId === msg.id ? null : msg.id;
        renderScheduledMessages(sorted);
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-danger btn-sm';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => removeScheduledMessage(msg.id));

      actions.appendChild(editBtn);
      actions.appendChild(removeBtn);
      timeRow.appendChild(timeEl);
      timeRow.appendChild(actions);

      item.appendChild(topRow);
      item.appendChild(timeRow);

      if (editingScheduledId === msg.id) {
        const editRow = document.createElement('div');
        editRow.className = 'scheduled-edit-row';

        const dtInput = document.createElement('input');
        dtInput.type = 'datetime-local';
        dtInput.value = toLocalDatetimeValue(msg.scheduledTime);

        const recSelect = document.createElement('select');
        [
          ['none', 'Once'],
          ['daily', 'Daily'],
          ['weekly', 'Weekly'],
          ['monthly', 'Monthly']
        ].forEach(([val, label]) => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = label;
          if (val === recurrence) opt.selected = true;
          recSelect.appendChild(opt);
        });

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-primary btn-sm';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () =>
          rescheduleMessage(msg.id, dtInput.value, recSelect.value)
        );

        editRow.appendChild(dtInput);
        editRow.appendChild(recSelect);
        editRow.appendChild(saveBtn);
        item.appendChild(editRow);
      }

      scheduledList.appendChild(item);
    });
  }

  async function renderScheduledHistory(historyArg) {
    if (!historyList) return;
    const history = Array.isArray(historyArg)
      ? historyArg
      : await StorageService.getScheduledHistory();

    if (historyCountBadge) {
      historyCountBadge.textContent = String(history.length);
    }
    if (historyToolbar) {
      historyToolbar.classList.toggle('hidden', history.length === 0);
    }

    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-scheduled">No delivery history yet.</div>';
      return;
    }

    history.forEach(entry => {
      const details = entry.details || {};
      const item = document.createElement('div');
      item.className = 'scheduled-item';

      const topRow = document.createElement('div');
      topRow.className = 'scheduled-item-top';

      const info = document.createElement('div');
      info.className = 'scheduled-item-info';

      const subjectEl = document.createElement('div');
      subjectEl.className = 'scheduled-subject';
      subjectEl.textContent = details.subject || '(No Subject)';

      const toList = Array.isArray(details.to) ? details.to.join(', ') : '';
      const metaEl = document.createElement('div');
      metaEl.className = 'scheduled-meta';
      metaEl.textContent = toList ? `To: ${toList}` : 'No recipients';

      info.appendChild(subjectEl);
      info.appendChild(metaEl);
      topRow.appendChild(info);

      const badgesWrap = document.createElement('div');
      badgesWrap.className = 'scheduled-badges';

      const statusBadge = document.createElement('span');
      statusBadge.className = entry.status === 'failed' ? 'badge badge-danger' : 'badge badge-success';
      statusBadge.textContent = entry.status === 'failed' ? 'Failed' : 'Sent';
      badgesWrap.appendChild(statusBadge);

      const attCount = Array.isArray(details.attachments) ? details.attachments.length : 0;
      if (attCount > 0) {
        const attBadge = document.createElement('span');
        attBadge.className = 'badge badge-primary';
        attBadge.textContent = `${attCount} file${attCount > 1 ? 's' : ''}`;
        badgesWrap.appendChild(attBadge);
      }

      topRow.appendChild(badgesWrap);

      const timeRow = document.createElement('div');
      timeRow.className = 'scheduled-time-row';

      const timeEl = document.createElement('span');
      timeEl.className = 'scheduled-time';
      timeEl.textContent = new Date(entry.sentAt).toLocaleString();

      const actions = document.createElement('div');
      actions.className = 'scheduled-actions';

      const draftBtn = document.createElement('button');
      draftBtn.type = 'button';
      draftBtn.className = 'btn-secondary btn-sm';
      draftBtn.textContent = 'Open Draft';
      draftBtn.addEventListener('click', () => openHistoryDraft(entry));

      const againBtn = document.createElement('button');
      againBtn.type = 'button';
      againBtn.className = 'btn-primary btn-sm';
      againBtn.textContent = 'Reschedule';
      againBtn.addEventListener('click', () => {
        reschedulingHistoryId = reschedulingHistoryId === entry.id ? null : entry.id;
        renderScheduledHistory(history);
      });

      actions.appendChild(draftBtn);
      actions.appendChild(againBtn);
      timeRow.appendChild(timeEl);
      timeRow.appendChild(actions);

      item.appendChild(topRow);
      if (entry.status === 'failed' && entry.error) {
        const errEl = document.createElement('div');
        errEl.className = 'history-error';
        errEl.textContent = entry.error;
        item.appendChild(errEl);
      }
      item.appendChild(timeRow);

      if (reschedulingHistoryId === entry.id) {
        const editRow = document.createElement('div');
        editRow.className = 'scheduled-edit-row';

        const dtInput = document.createElement('input');
        dtInput.type = 'datetime-local';
        dtInput.value = toLocalDatetimeValue(Date.now() + 3600000);

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-primary btn-sm';
        saveBtn.textContent = 'Schedule';
        saveBtn.addEventListener('click', () => scheduleFromHistory(entry, dtInput.value));

        editRow.appendChild(dtInput);
        editRow.appendChild(saveBtn);
        item.appendChild(editRow);
      }

      historyList.appendChild(item);
    });
  }

  syncTheme();
  updateAutoAttachUI(settings.autoAttach);
  updateFeatureBadge(schedulingBadge, settings.mailScheduling);
  updateFeatureBadge(templatesBadge, settings.quickTemplate);
  await Promise.all([renderScheduledMessages(), renderScheduledHistory()]);

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      await StorageService.clearScheduledHistory();
      await renderScheduledHistory([]);
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', async () => {
      const current = document.body.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      settings.theme = next;
      await StorageService.saveSettings({ theme: next });
      syncTheme();
    });
  }

  if (api && api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.scheduledMessages) {
        renderScheduledMessages(changes.scheduledMessages.newValue || []);
      }
      if (changes.scheduledHistory) {
        renderScheduledHistory(changes.scheduledHistory.newValue || []);
      }
      if (changes.theme) {
        settings.theme = changes.theme.newValue || 'light';
        syncTheme();
      }
      if (changes.autoAttach) {
        updateAutoAttachUI(changes.autoAttach.newValue);
      }
      if (changes.mailScheduling) {
        updateFeatureBadge(schedulingBadge, changes.mailScheduling.newValue);
      }
      if (changes.quickTemplate) {
        updateFeatureBadge(templatesBadge, changes.quickTemplate.newValue);
      }
    });
  }

  function openSettingsPage(event) {
    event.preventDefault();
    if (api && api.runtime && api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    }
  }

  if (headerSettingsBtn) headerSettingsBtn.addEventListener('click', openSettingsPage);
});
