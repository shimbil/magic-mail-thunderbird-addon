/**
 * Storage Service - Magic Mail
 * Manages extension preferences, templates, and scheduled messages.
 * Uses messenger/browser.storage.local consistently across all extension pages.
 * Developer: Al Shimbil Khan <shimbilmax@gmail.com> | +8801516711976
 */

var StorageService = class StorageService {
  static get DEFAULT_SETTINGS() {
    return {
      autoAttach: false,
      mailScheduling: true,
      quickTemplate: true,
      notifySuccess: false,
      debugLogs: false,
      theme: 'light' // 'light' | 'dark' | 'system'
    };
  }

  static get DEFAULT_TEMPLATES() {
    return [
      {
        id: 'tpl_meeting_followup',
        title: 'Meeting Follow-Up & Next Steps',
        category: 'Business',
        content: 'Hi team,\n\nThank you for attending today\'s meeting. Below is a brief summary of our discussion, key decisions, and immediate next steps:\n\nKey Takeaways:\n• [Item 1]\n• [Item 2]\n\nNext Steps & Action Items:\n• [Owner] — [Action Item] (Due: [Date])\n\nPlease let me know if I missed anything or if you have any questions.\n\nBest regards,'
      },
      {
        id: 'tpl_project_status',
        title: 'Project Status Update',
        category: 'Updates',
        content: 'Hi [Name],\n\nHere is a quick update on project progress for this week:\n\nAccomplishments:\n• [Milestone completed]\n• [Feature deployed]\n\nIn Progress:\n• [Current task]\n\nBlockers / Risks:\n• None at this time.\n\nWe remain on schedule for our upcoming milestone on [Date]. Let me know if you need any additional details.\n\nBest,'
      },
      {
        id: 'tpl_polite_reminder',
        title: 'Gentle Reminder & Follow-Up',
        category: 'Follow-Up',
        content: 'Hi [Name],\n\nI hope you\'re having a productive week.\n\nI wanted to gently follow up on my previous message regarding [Subject/Document]. Whenever you have a chance, could you please review and share your feedback?\n\nIf you need any additional context or clarification, I\'m happy to help.\n\nThank you for your time,'
      },
      {
        id: 'tpl_introduction',
        title: 'Professional Introduction',
        category: 'Outreach',
        content: 'Dear [Name],\n\nI hope this email finds you well.\n\nMy name is [Your Name], and I am reaching out regarding [Topic/Opportunity]. Having followed your work on [Area/Project], I believe there is strong alignment between our goals.\n\nI would welcome a brief 10-minute conversation this week or next to discuss how we might collaborate.\n\nLooking forward to hearing from you,\n\nBest regards,'
      }
    ];
  }

  /**
   * Returns the active Thunderbird WebExtension API namespace.
   * @returns {typeof browser | null}
   */
  static getApi() {
    if (typeof messenger !== 'undefined') return messenger;
    if (typeof browser !== 'undefined') return browser;
    return null;
  }

  /**
   * Retrieves all settings merged with defaults.
   * @returns {Promise<Object>}
   */
  static async getSettings() {
    const defaults = this.DEFAULT_SETTINGS;
    const api = this.getApi();

    if (api && api.storage && api.storage.local) {
      try {
        const stored = await api.storage.local.get(defaults);
        return { ...defaults, ...stored };
      } catch (err) {
        console.warn('StorageService: failed to read settings', err);
      }
    }

    return { ...defaults };
  }

  /**
   * Saves partial or full settings to local storage.
   * @param {Object} partial
   * @returns {Promise<void>}
   */
  static async saveSettings(partial) {
    const api = this.getApi();
    if (api && api.storage && api.storage.local) {
      await api.storage.local.set(partial);
    }
  }

  /**
   * Normalizes a template object to { id, title, category, content }.
   * @param {Object} tpl
   * @returns {Object}
   */
  static normalizeTemplate(tpl) {
    return {
      id: String(tpl.id || `tpl_${Date.now()}`),
      title: String(tpl.title || 'Untitled Template'),
      category: String(tpl.category || 'General'),
      content: String(tpl.content !== undefined ? tpl.content : (tpl.body || '')),
      updatedAt: tpl.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Retrieves all saved templates (built-in defaults + user-created).
   * @returns {Promise<Array<{id: string, title: string, category: string, content: string}>>}
   */
  static async getTemplates() {
    const api = this.getApi();
    let custom = [];
    let deletedIds = [];

    if (api && api.storage && api.storage.local) {
      try {
        const data = await api.storage.local.get({
          templates: [],
          deletedDefaultTemplates: []
        });
        custom = Array.isArray(data.templates) ? data.templates.map(t => this.normalizeTemplate(t)) : [];
        deletedIds = Array.isArray(data.deletedDefaultTemplates) ? data.deletedDefaultTemplates : [];
      } catch (err) {
        console.warn('StorageService: failed to read templates', err);
      }
    }

    const combined = [...custom];
    this.DEFAULT_TEMPLATES.forEach(def => {
      if (!deletedIds.includes(def.id) && !combined.some(t => t.id === def.id)) {
        combined.unshift(this.normalizeTemplate(def));
      }
    });

    return combined;
  }

  /**
   * Saves a new template or updates an existing one.
   * @param {Object} template - { id?, title, category, content }
   * @returns {Promise<Object>}
   */
  static async saveTemplate(template) {
    const api = this.getApi();
    const { templates = [] } = api && api.storage
      ? await api.storage.local.get({ templates: [] })
      : { templates: [] };

    const normalizedList = Array.isArray(templates)
      ? templates.map(t => this.normalizeTemplate(t))
      : [];

    const id = template.id || `tpl_${Date.now()}`;
    const newTpl = this.normalizeTemplate({
      ...template,
      id,
      updatedAt: new Date().toISOString()
    });

    const idx = normalizedList.findIndex(t => t.id === id);
    if (idx !== -1) {
      normalizedList[idx] = newTpl;
    } else {
      normalizedList.unshift(newTpl);
    }

    if (api && api.storage && api.storage.local) {
      await api.storage.local.set({ templates: normalizedList });
    }
    return newTpl;
  }

  /**
   * Deletes a template by ID (tracks deleted built-in defaults so they stay hidden).
   * @param {string} id
   * @returns {Promise<void>}
   */
  static async deleteTemplate(id) {
    const api = this.getApi();
    if (!api || !api.storage || !api.storage.local) return;

    const data = await api.storage.local.get({
      templates: [],
      deletedDefaultTemplates: []
    });

    const custom = Array.isArray(data.templates)
      ? data.templates.filter(t => t.id !== id)
      : [];

    const deletedIds = Array.isArray(data.deletedDefaultTemplates)
      ? [...data.deletedDefaultTemplates]
      : [];

    if (this.DEFAULT_TEMPLATES.some(d => d.id === id) && !deletedIds.includes(id)) {
      deletedIds.push(id);
    }

    await api.storage.local.set({
      templates: custom,
      deletedDefaultTemplates: deletedIds
    });
  }

  /**
   * Checks whether any built-in default templates have been deleted.
   * @returns {Promise<boolean>}
   */
  static async hasDeletedDefaultTemplates() {
    const api = this.getApi();
    if (!api || !api.storage || !api.storage.local) return false;
    const { deletedDefaultTemplates = [] } = await api.storage.local.get({
      deletedDefaultTemplates: []
    });
    return Array.isArray(deletedDefaultTemplates) && deletedDefaultTemplates.length > 0;
  }

  /**
   * Restores all built-in default templates.
   * @returns {Promise<void>}
   */
  static async restoreDefaultTemplates() {
    const api = this.getApi();
    if (!api || !api.storage || !api.storage.local) return;
    await api.storage.local.set({ deletedDefaultTemplates: [] });
  }

  /**
   * Persists a raw templates array (used for bulk import).
   * @param {Array<Object>} templates
   * @returns {Promise<void>}
   */
  static async saveTemplates(templates) {
    const api = this.getApi();
    if (api && api.storage && api.storage.local) {
      await api.storage.local.set({
        templates: (templates || []).map(t => this.normalizeTemplate(t))
      });
    }
  }

  /**
   * Sanitizes a ComposeDetails object for safe storage and compose.beginNew().
   * Ensures body and plainTextBody are never both set simultaneously.
   * @param {Object} details
   * @returns {Object}
   */
  static sanitizeComposeDetails(details) {
    const src = details || {};
    const clean = {};

    if (src.identityId) clean.identityId = src.identityId;
    if (Array.isArray(src.to) && src.to.length) clean.to = src.to;
    if (Array.isArray(src.cc) && src.cc.length) clean.cc = src.cc;
    if (Array.isArray(src.bcc) && src.bcc.length) clean.bcc = src.bcc;
    if (Array.isArray(src.replyTo) && src.replyTo.length) clean.replyTo = src.replyTo;
    if (typeof src.subject === 'string') clean.subject = src.subject;

    const isHTML = src.isHTML !== false;
    if (isHTML && typeof src.body === 'string') {
      clean.body = src.body;
    } else {
      clean.plainTextBody = typeof src.plainTextBody === 'string' ? src.plainTextBody : '';
    }

    if (Array.isArray(src.attachments)) {
      clean.attachments = src.attachments
        .filter(att => att && att.file)
        .map(att => ({
          file: att.file,
          name: att.name || att.file.name
        }));
    }

    return clean;
  }

  /**
   * Retrieves scheduled messages queue.
   * @returns {Promise<Array<Object>>}
   */
  static async getScheduledMessages() {
    const api = this.getApi();
    if (api && api.storage && api.storage.local) {
      const { scheduledMessages = [] } = await api.storage.local.get({ scheduledMessages: [] });
      return Array.isArray(scheduledMessages) ? scheduledMessages : [];
    }
    return [];
  }

  /**
   * Persists scheduled messages queue.
   * @param {Array<Object>} scheduledMessages
   * @returns {Promise<void>}
   */
  static async saveScheduledMessages(scheduledMessages) {
    const api = this.getApi();
    if (api && api.storage && api.storage.local) {
      await api.storage.local.set({ scheduledMessages });
    }
  }

  /**
   * Retrieves scheduled mail delivery history (most recent first).
   * @returns {Promise<Array<Object>>}
   */
  static async getScheduledHistory() {
    const api = this.getApi();
    if (api && api.storage && api.storage.local) {
      const { scheduledHistory = [] } = await api.storage.local.get({ scheduledHistory: [] });
      return Array.isArray(scheduledHistory) ? scheduledHistory : [];
    }
    return [];
  }

  /**
   * Appends a delivery record to scheduled mail history (keeps last 50 entries).
   * @param {Object} entry
   * @returns {Promise<void>}
   */
  static async addScheduledHistory(entry) {
    const api = this.getApi();
    if (!api || !api.storage || !api.storage.local) return;
    const history = await this.getScheduledHistory();
    history.unshift(entry);
    await api.storage.local.set({ scheduledHistory: history.slice(0, 50) });
  }

  /**
   * Clears all scheduled mail history entries.
   * @returns {Promise<void>}
   */
  static async clearScheduledHistory() {
    const api = this.getApi();
    if (api && api.storage && api.storage.local) {
      await api.storage.local.set({ scheduledHistory: [] });
    }
  }

  /**
   * Computes the next occurrence timestamp for a recurring schedule.
   * Advances past `minTime` (defaults to Date.now()) so missed runs skip cleanly.
   * @param {number} currentTimestamp
   * @param {'none' | 'daily' | 'weekly' | 'monthly'} recurrence
   * @param {number} [minTime=Date.now()]
   * @returns {number | null}
   */
  static computeNextOccurrence(currentTimestamp, recurrence, minTime = Date.now()) {
    if (!recurrence || recurrence === 'none') return null;

    const addInterval = (ts) => {
      const d = new Date(ts);
      if (recurrence === 'daily') {
        d.setDate(d.getDate() + 1);
      } else if (recurrence === 'weekly') {
        d.setDate(d.getDate() + 7);
      } else if (recurrence === 'monthly') {
        const targetDay = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + 1);
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(targetDay, daysInMonth));
      } else {
        return null;
      }
      return d.getTime();
    };

    let next = addInterval(currentTimestamp);
    if (!next) return null;
    while (next <= minTime) {
      next = addInterval(next);
    }
    return next;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.StorageService = StorageService;
}
