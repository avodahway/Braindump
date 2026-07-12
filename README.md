# Brain Dump

Brain Dump is an installable React + TypeScript + Vite PWA for turning a free-form brain dump into routed actions for Google Calendar, Google Tasks, Cleveland Stewardship OS projects, waiting-on items, and later Gmail.

Tagline: **Get it out. We'll handle the rest.**

## Local Setup

```sh
pnpm install
pnpm dev
```

The app starts with a mocked backend. Leave Settings -> Backend URL blank to test parsing and grouped results locally.

## Checks

```sh
pnpm test
pnpm build
```

## Backend Settings

Open the Settings button in the app and enter:

- Backend URL: deployed Google Apps Script web app URL.
- Shared secret: optional development secret that must match the Apps Script property `BRAIN_DUMP_SHARED_SECRET`.

No Google credentials are stored in the frontend. The PWA sends a JSON request to the Apps Script bridge, and Apps Script performs Google Calendar, Tasks, and Sheet writes server-side.

## Apps Script Deployment

1. Open the existing Cleveland Stewardship OS Apps Script project.
2. Copy `apps-script/BrainDumpBridge.gs` into that project.
3. Enable the Google Tasks Advanced Service if it is not already enabled.
4. Set script properties as needed:
   - `BRAIN_DUMP_SHARED_SECRET`
   - `CSOS_SPREADSHEET_ID`
   - `CSOS_WORK_TASK_LIST_ID`
   - `CSOS_PERSONAL_TASK_LIST_ID`
   - `CSOS_WORK_CALENDAR_ID`
   - `CSOS_PERSONAL_CALENDAR_ID`
5. Deploy as a Web App that executes as you and is accessible to the intended user.
6. Paste the Web App URL into Brain Dump Settings.

Apps Script CORS can be awkward. This bridge accepts `text/plain` JSON to avoid browser preflight in the simple development path. If that becomes limiting, add a small same-origin serverless proxy and keep the frontend contract unchanged.

## Migration Note

The bridge is designed to live beside the existing Cleveland Stewardship OS script, not replace it. It writes projects to `Active Projects`, waiting items to `Waiting On`, logs to `CSOS Execution Log`, and uses Google Tasks list IDs from script properties. Keep the existing spreadsheet tabs and Apps Script services enabled, especially the Google Tasks Advanced Service.

## Repository Boundary

This is a standalone repository for `brain-dump-app`. It is not a branch or subfolder of the Providence Timeline repository.
