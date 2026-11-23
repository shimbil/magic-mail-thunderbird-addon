# Magic Mail - Thunderbird Add-on

Magic Mail is a productivity-focused Thunderbird add-on that automatically re-attaches files from the original email when you reply or reply-all, provides mail scheduling with attachment preservation, and offers quick response templates.

## Features
- **Auto-Attachment**: Automatically copies non-signature attachments from the original email when you reply or reply-all.
- **Manual Reply with Attachments**: One-click **Reply with Attachments** and **Reply All with Attachments** from the message header toolbar.
- **Mail Scheduling & Recurring Emails**: Schedule one-time or recurring (**Daily**, **Weekly**, **Monthly**) emails with attachments, view/edit/pause/remove upcoming deliveries, and review or re-schedule past deliveries from the **History** log in the main toolbar popup.
- **Quick Templates**: Create, edit, import, and export reusable email templates and insert them from the compose toolbar popup or compose body context menu.
- **Light & Dark Themes**: Built-in Light and Dark mode support synchronized across popups and Settings.

## Entry Points
1. **Main Toolbar (`Magic Mail`)**: Toggle Auto-Attach, view active feature status, and view/edit/remove scheduled messages.
2. **Message Header Toolbar (`Reply With`)**: Trigger Reply or Reply All with original attachments on demand.
3. **Compose Toolbar (`Advance Options`)**: Schedule email delivery or search and insert saved templates.
4. **Compose Body Context Menu (`Quick Templates`)**: Right-click inside the compose editor to insert a saved template.
5. **Add-on Settings**: Configure all toggles, manage templates, and import/export JSON backups.

## Build & Package
Run the build script to validate the manifest, HTML references, and JavaScript syntax and generate `.xpi` packages:
```bash
bash scripts/build.sh
```

## Developer Information
- **Name**: Al Shimbil Khan
- **Phone**: +8801516711976
- **Email**: shimbilmax@gmail.com
