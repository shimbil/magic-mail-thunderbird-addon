/**
 * Magic Mail - Background Service Script
 * Handles auto-attaching files on reply, manual attachment replies,
 * scheduled email delivery, and Quick Template context menus.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

const api = typeof messenger !== 'undefined' ? messenger : browser;

// Track processed tabs to prevent double-attachment
const processedTabs = new Set();
const attachmentLock = new Set();

/**
 * Logs diagnostic messages when debugLogs is enabled in settings.
 * @param {...any} args
 */
async function log(...args) {
  const settings = await api.storage.local.get({ debugLogs: false });
  if (settings.debugLogs) {
    console.log('Magic Mail:', ...args);
  }
}

log('Starting background script...');

/**
 * Fetches and attaches files from a source message to a target compose tab.
 * @param {number} tabId
 * @param {number} sourceId
 * @returns {Promise<number>}
 */
async function attachFilesFromMessage(tabId, sourceId) {
  if (!sourceId) return 0;

  const lockKey = `${sourceId}-${tabId}`;
  if (attachmentLock.has(lockKey)) return 0;
  attachmentLock.add(lockKey);
  setTimeout(() => attachmentLock.delete(lockKey), 5000);

  try {
    log(`Fetching attachments from ${sourceId}...`);
    const attachments = await api.messages.listAttachments(sourceId);

    if (!attachments || attachments.length === 0) {
      log('Original message has no attachments.');
      return 0;
    }

    let count = 0;
    for (const att of attachments) {
      if (att.name === 'smime.p7s') continue; // Skip digital signatures

      try {
        log(`Attaching ${att.name}...`);
        const file = await api.messages.getAttachmentFile(sourceId, att.partName);
        await api.compose.addAttachment(tabId, { file, name: att.name });
        count++;
      } catch (err) {
        console.error(`Magic Mail: Failed to attach ${att.name}:`, err);
      }
    }
    return count;
  } catch (err) {
    console.error('Magic Mail: Error in attachFilesFromMessage:', err);
    return 0;
  }
}

/**
 * Shows a system notification when attachments are added.
 * @param {number} count
 */
async function notifySuccess(count) {
  const settings = await api.storage.local.get({ notifySuccess: false });
  if (settings.notifySuccess && count > 0) {
    api.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-96.png',
      title: 'Magic Mail',
      message: `Auto-attached ${count} file(s) from the original message.`
    });
  }
}

/**
 * Processes a newly created compose tab for automatic attachment copying.
 * @param {number} tabId
 */
async function processTab(tabId) {
  if (processedTabs.has(tabId)) return;

  const settings = await api.storage.local.get({
    autoAttach: false,
    notifySuccess: false,
    debugLogs: false
  });

  if (!settings.autoAttach) return;

  processedTabs.add(tabId);
  setTimeout(() => processedTabs.delete(tabId), 10000);

  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    const details = await api.compose.getComposeDetails(tabId);

    if (['reply', 'replyAll', 'replyToGroup'].includes(details.type) && details.relatedMessageId) {
      const count = await attachFilesFromMessage(tabId, details.relatedMessageId);
      await notifySuccess(count);
    }
  } catch (err) {
    log('Tab not ready or not a compose tab.');
  }
}

/**
 * Inserts template text into a compose tab using insertText with setComposeDetails fallback.
 * @param {number} tabId
 * @param {string} text
 */
async function insertTextSmart(tabId, text) {
  try {
    if (api.compose.insertText) {
      log('Attempting insertText...');
      await api.compose.insertText(tabId, text);
      log('Successfully inserted via insertText.');
      return;
    }
    throw new Error('insertText API not found');
  } catch (err) {
    log('insertText failed or missing, using setComposeDetails fallback:', err.message);

    const details = await api.compose.getComposeDetails(tabId);
    const isHTML = details.isHTML !== false;

    if (isHTML) {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const safeText = escaped.replace(/\n/g, '<br>');
      const separator = '<br><br>';
      const existingBody = details.body || '';

      const newBody = existingBody.toLowerCase().includes('<body')
        ? existingBody.replace(/(<body[^>]*>)/i, `$1${safeText}${separator}`)
        : safeText + separator + existingBody;

      await api.compose.setComposeDetails(tabId, { body: newBody });
    } else {
      const separator = '\n\n';
      const newBody = text + separator + (details.plainTextBody || '');
      await api.compose.setComposeDetails(tabId, { plainTextBody: newBody });
    }
    log('Successfully inserted via setComposeDetails fallback.');
  }
}

/**
 * Handles runtime messages from popups.
 */
api.runtime.onMessage.addListener((message) => {
  if (!message || !message.action) return undefined;

  if (message.action === 'manualReplyWithAttachments') {
    return (async () => {
      try {
        log(`Manual Reply triggered for ${message.messageId} (Reply All: ${message.replyAll})`);

        const replyType = message.replyAll ? 'replyToAll' : 'replyToSender';
        const tab = await api.compose.beginReply(message.messageId, replyType);

        processedTabs.add(tab.id);
        setTimeout(() => processedTabs.delete(tab.id), 5000);

        await new Promise(resolve => setTimeout(resolve, 500));

        const count = await attachFilesFromMessage(tab.id, message.messageId);
        await notifySuccess(count);

        if (message.template) {
          await insertTextSmart(tab.id, message.template);
        }
        return { success: true };
      } catch (err) {
        console.error('Magic Mail: Manual Reply failed:', err);
        return { success: false, error: err.message };
      }
    })();
  }

  if (message.action === 'insertTemplateAtCursor') {
    return (async () => {
      try {
        log('Template insertion requested...');
        if (message.tabId) {
          await insertTextSmart(message.tabId, message.content);
          return { success: true };
        }

        const windows = await api.windows.getAll({ windowTypes: ['messageCompose'] });
        const targetWindow = windows.find(w => w.focused) || windows[0];

        if (targetWindow) {
          const tabs = await api.tabs.query({ windowId: targetWindow.id });
          if (tabs.length > 0) {
            await insertTextSmart(tabs[0].id, message.content);
            return { success: true };
          }
        }
        return { success: false, error: 'No compose window found.' };
      } catch (err) {
        console.error('Magic Mail: Template insertion failed:', err);
        return { success: false, error: err.message };
      }
    })();
  }

  return undefined;
});

// Listeners across Thunderbird versions
if (api.compose && api.compose.onAfterCreated) {
  api.compose.onAfterCreated.addListener((tab) => processTab(tab.id));
}

api.tabs.onCreated.addListener((tab) => {
  if (tab.type === 'messageCompose' || !tab.type) {
    processTab(tab.id);
  }
});

api.windows.onCreated.addListener(async (win) => {
  if (win.type === 'messageCompose') {
    const tabs = await api.tabs.query({ windowId: win.id });
    if (tabs.length > 0) processTab(tabs[0].id);
  }
});

/**
 * Handles scheduled and recurring message delivery alarms.
 */
api.alarms.onAlarm.addListener(async (alarm) => {
  const scheduledMessages = await StorageService.getScheduledMessages();
  const index = scheduledMessages.findIndex(m => m.id === alarm.name);

  if (index === -1) return;

  const message = scheduledMessages[index];
  if (message.paused) return;

  try {
    const details = StorageService.sanitizeComposeDetails(message.details);

    const tab = await api.compose.beginNew(details);
    await api.compose.sendMessage(tab.id, { mode: 'sendNow' });
    const recipients = [
      ...(Array.isArray(details.to) ? details.to : []),
      ...(Array.isArray(details.cc) ? details.cc : []),
      ...(Array.isArray(details.bcc) ? details.bcc : [])
    ].join(', ');
    api.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-96.png',
      title: 'Magic Mail',
      message: recipients
        ? `Scheduled message to "${recipients}" sent.`
        : 'Scheduled message sent.'
    });

    await StorageService.addScheduledHistory({
      id: `hist_${Date.now()}`,
      sentAt: Date.now(),
      status: 'sent',
      recurrence: message.recurrence || 'none',
      details: message.details
    });
  } catch (err) {
    console.error('Magic Mail: Scheduled send failed:', err);
    await StorageService.addScheduledHistory({
      id: `hist_${Date.now()}`,
      sentAt: Date.now(),
      status: 'failed',
      error: err.message || 'Unknown error',
      recurrence: message.recurrence || 'none',
      details: message.details
    });
  } finally {
    const latestMessages = await StorageService.getScheduledMessages();
    const latestIndex = latestMessages.findIndex(m => m.id === message.id);
    if (latestIndex !== -1) {
      const latestMsg = latestMessages[latestIndex];
      const recurrence = latestMsg.recurrence || 'none';
      if (recurrence !== 'none') {
        const nextTime = StorageService.computeNextOccurrence(latestMsg.scheduledTime, recurrence);
        if (nextTime) {
          latestMsg.scheduledTime = nextTime;
          await StorageService.saveScheduledMessages(latestMessages);
          if (!latestMsg.paused) {
            api.alarms.create(latestMsg.id, { when: nextTime });
          }
        }
      } else {
        latestMessages.splice(latestIndex, 1);
        await StorageService.saveScheduledMessages(latestMessages);
      }
    }
  }
});

/**
 * Ensures active scheduled/recurring alarms are registered on startup.
 */
async function reconcileScheduledAlarms() {
  const scheduledMessages = await StorageService.getScheduledMessages();
  let changed = false;

  for (const msg of scheduledMessages) {
    if (msg.paused) continue;
    const recurrence = msg.recurrence || 'none';
    if (recurrence !== 'none' && msg.scheduledTime <= Date.now()) {
      const nextTime = StorageService.computeNextOccurrence(msg.scheduledTime, recurrence);
      if (nextTime) {
        msg.scheduledTime = nextTime;
        changed = true;
      }
    }
    if (msg.scheduledTime > Date.now()) {
      const existing = api.alarms.get ? await api.alarms.get(msg.id) : null;
      if (!existing) {
        api.alarms.create(msg.id, { when: msg.scheduledTime });
      }
    }
  }

  if (changed) {
    await StorageService.saveScheduledMessages(scheduledMessages);
  }
}

/**
 * Initializes compose body context menus for Quick Templates.
 */
async function initMenus() {
  const { quickTemplate = true } = await api.storage.local.get({
    quickTemplate: true
  });
  const templates = await StorageService.getTemplates();

  api.menus.removeAll();

  if (quickTemplate && templates.length > 0) {
    api.menus.create({
      id: 'quickTemplates',
      title: 'Quick Templates',
      contexts: ['compose_body']
    });

    templates.forEach(tpl => {
      api.menus.create({
        id: `tpl_${tpl.id}`,
        parentId: 'quickTemplates',
        title: tpl.title,
        contexts: ['compose_body']
      });
    });
  }
}

api.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('tpl_')) {
    const id = info.menuItemId.replace('tpl_', '');
    const templates = await StorageService.getTemplates();
    const tpl = templates.find(t => t.id === id);

    if (tpl) {
      await insertTextSmart(tab.id, tpl.content || tpl.body || '');
    }
  }
});

api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.quickTemplate || changes.templates || changes.deletedDefaultTemplates)) {
    initMenus();
  }
});

initMenus();
reconcileScheduledAlarms();

log('All listeners active.');
