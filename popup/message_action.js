/**
 * Magic Mail - Message Display Action Popup Controller
 * Triggers manual Reply / Reply All with original attachments.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

document.addEventListener('DOMContentLoaded', async () => {
  const api = StorageService.getApi();
  const replyBtn = document.getElementById('replyBtn');
  const replyAllBtn = document.getElementById('replyAllBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const actionAlert = document.getElementById('actionAlert');

  const settings = await StorageService.getSettings();
  UIHelpers.applyTheme(settings.theme || 'light');

  function showError(message) {
    if (!actionAlert) return;
    actionAlert.textContent = message;
    actionAlert.classList.remove('hidden');
  }

  async function handleReply(replyAll = false) {
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      const message = await api.messageDisplay.getDisplayedMessage(tab.id);

      if (!message) {
        showError('No message detected in the active tab.');
        return;
      }

      await api.runtime.sendMessage({
        action: 'manualReplyWithAttachments',
        messageId: message.id,
        replyAll
      });

      window.close();
    } catch (err) {
      console.error('Magic Mail: manual reply failed:', err);
      showError(`Error: ${err.message}`);
    }
  }

  if (replyBtn) replyBtn.addEventListener('click', () => handleReply(false));
  if (replyAllBtn) replyAllBtn.addEventListener('click', () => handleReply(true));

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      if (api && api.runtime && api.runtime.openOptionsPage) {
        api.runtime.openOptionsPage();
      }
    });
  }
});
