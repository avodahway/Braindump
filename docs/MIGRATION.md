# Cleveland Stewardship OS Private Adapter

Brain Dump can use the Cleveland Stewardship OS Apps Script project as a private execution bridge. This path is not the default public backend.

## Required IDs

- Cleveland Stewardship OS spreadsheet ID.
- Work task-list ID for `Avodah Work`.
- Personal/default Google Tasks task-list ID.
- Work calendar ID, if not `primary`.
- Personal calendar ID, if different from `primary`.
- Optional shared secret for development.

Store these in Apps Script Properties, never in the PWA source.

## Compatibility

The bridge preserves these sheet names from the prototype:

- `Active Projects`
- `Waiting On`
- `CSOS Execution Log`

The old modal UI can remain in the sheet project. The new PWA calls `doPost(e)` and receives structured JSON.
