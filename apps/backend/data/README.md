# Local Content Storage

Local development can store admin-created game content in a project-side JSON file.

Recommended local settings:

```env
CONTENT_STORAGE_MODE=file
CONTENT_DATA_DIR=./data
CONTENT_DATA_FILE=theend_content.local.json
```

`theend_content.local.json` is working local content and is ignored by Git. Export backups from the Admin UI and move those JSON files through Google Drive when switching computers.

`theend_content.example.json` is a committed empty starter file.

