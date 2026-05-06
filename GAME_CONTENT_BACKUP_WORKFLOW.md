# Game Content Backup Workflow

GitHub is for code. Google Drive is for exported game content backups.

The local PostgreSQL database is the working storage for admin-created content while developing. Code changes can be committed and pulled through GitHub, but admin content must be moved manually with JSON exports.

## Recommended Routine

1. Before switching PC, open Admin Export/Import and export a full content backup.
2. Upload the JSON file to Google Drive.
3. On the other PC, pull the latest code from GitHub.
4. Download the latest JSON backup from Google Drive.
5. Import the JSON in Admin Export/Import. Run the dry run first, then usually choose Replace all.
6. Continue development.

Always export after admin content changes that matter. Always import the latest backup before working on another computer.

## File Naming

Use this format:

```text
theend_content_YYYY-MM-DD_HH-mm.json
```

Examples:

```text
theend_content_2026-05-06_22-30_work_laptop.json
theend_content_2026-05-06_23-10_home_pc.json
```

The optional suffix can identify where the backup came from, such as `home_pc`, `work_laptop`, or `local`.

## Import Modes

Use Dry run / validate only first. It reads the file, checks the schema, shows counts and warnings, and does not modify local content.

Use Replace all content when moving from one PC to another after making a fresh local export. This clears the current local content state and imports the backup, which is the safest workflow for laptop/home handoff.

Use Merge by ID when you intentionally want to keep local-only records. Matching IDs are updated, missing IDs are added, and local-only records are not deleted.

## Images

Backups can include embedded image records. Large image-heavy JSON files may take longer to import or upload to Google Drive.

If the backup only contains image references, copy the matching assets folder or zip alongside the JSON. Missing image references should be treated as warnings to fix, not as a reason to throw away the backup.

## Recovery

If an import looks wrong:

1. Do not continue editing content.
2. Export the current broken state with a clear filename, such as `theend_content_broken_import_YYYY-MM-DD_HH-mm.json`.
3. Import the previous known-good backup from Google Drive using Replace all.
4. Refresh the admin page and check quests, dialogues, NPCs, items, skills, cities, and maps.
5. If the JSON file is invalid, download it again from Google Drive and retry. Invalid JSON usually means the file was only partially downloaded or was edited by hand.

