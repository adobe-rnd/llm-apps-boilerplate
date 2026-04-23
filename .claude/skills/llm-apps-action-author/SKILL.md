---
name: llm-apps-action-author
description: Create and edit MCP tool handlers for the llm-apps Adobe I/O Runtime boilerplate. Use when the user asks to "add an action", "create an MCP tool", "scaffold a handler for llm-apps", "write a tool-only handler", "add a widget for my llm-app tool", or is working in a repo derived from the llm-apps boilerplate (has an `actions/` directory, `entry.js`, and depends on `@adobe/llm-apps-runtime`). Produces correctly shaped handlers (content + structuredContent), optional widget.html starters, explains the split-ownership model (handler code lives in-repo, metadata lives in the llm-apps UI), and shows how to smoke-test locally with `npm run dev:local` (no Adobe credentials) or `npm run dev` (Adobe I/O Runtime).
metadata:
  author: Adobe llm-apps
  version: 0.1.0
  mcp-server: llm-apps
---

# llm-apps-action-author

Author handlers for MCP tools in repos derived from the **llm-apps boilerplate** (Adobe I/O Runtime). This skill keeps you on the happy path: correct handler shape, correct return contract, correct widget resolution, correct local test loop.

## When to use this skill

Trigger on phrases like:

- "add an action to my llm-app"
- "create an MCP tool for llm-apps"
- "scaffold a handler"
- "add a widget for this action"
- "why isn't my tool showing up?"
- Any repo whose root contains `entry.js`, an `actions/` directory, and depends on `@adobe/llm-apps-runtime` (server core is the runtime package, not in-repo).

Do **not** use this skill for:

- Adobe Commerce actions, AEM custom apps, or non-boilerplate App Builder projects.
- Authoring tool **metadata** (name, description, input schema, annotations, visibility, CSP). That lives in the llm-apps UI, not in code. If the user tries to edit metadata here, redirect them.

## The split-ownership model (read this first)

The boilerplate intentionally splits concerns between two systems:

| Concern | Where it lives | Who edits |
|---|---|---|
| Tool metadata (title, description, inputSchema, annotations, visibility, CSP, widget config) | llm-apps UI (DB) -> `actions.json` in production via the deploy pipeline | Product / UX / anyone with UI access |
| Tool logic (handler code, optional widget.html) | This repo | You |

**You never hand-edit metadata in code.** The developer's loop is:

1. Configure metadata in the UI.
2. Click **Download actions.json** on the Actions page -> drop it at the repo root.
3. Write the handler here.
4. `npm run dev:local` (zero Adobe credentials) or `npm run dev` (deploys to I/O Runtime) -> test -> `git push`.

The deploy pipeline then writes a fresh `actions.json` from the DB and builds.

If the user asks you to "set the description of my tool", "add CSP domains", or "change the inputSchema" -- **tell them to do it in the UI**, then re-download `actions.json`.

## Decision tree: which action shape?

```
Does the tool produce any output at all?
 ├─ No  -> pure widget. No handler folder needed.
 │        The action entry in actions.json with widget_type:"EDS" (or a widget.html file)
 │        registers it. Widget-only is legitimate.
 └─ Yes -> write a handler.
          │
          Does the result benefit from a visual UI beyond text?
           ├─ No  -> tool-only. Return { content: [...] }.
           ├─ Yes, and the widget is an AEM EDS page
           │       -> configure widget_type:"EDS" in the UI. No widget.html file.
           │          Handler returns { content, structuredContent }.
           └─ Yes, and it's custom (charts, interactive forms, etc.)
                   -> drop a widget.html next to index.js.
                      Handler returns { content, structuredContent }.
```

## Happy-path workflow

For any new action, follow these five steps in order. Use the scaffold script to avoid manual file creation.

### Step 1. Scaffold

From the repo root:

```bash
bash .claude/skills/llm-apps-action-author/scripts/scaffold-action.sh <action-name>
# Add --widget to also create widget.html
bash .claude/skills/llm-apps-action-author/scripts/scaffold-action.sh weather-lookup --widget
```

The script validates that `<action-name>` is kebab-case and creates:

- `actions/<action-name>/index.js` from `assets/handler-template.js` (or `handler-with-widget-template.js` if `--widget`)
- `actions/<action-name>/widget.html` from `assets/widget-template.html` when `--widget` is passed
- `test/actions/<action-name>.test.js` from `assets/handler-test-template.js` (always — never skip the test file)

### Step 2. Write the handler

Open `actions/<action-name>/index.js` and replace the TODOs. The contract is:

```js
module.exports = async (args) => ({
  content: [
    { type: 'text', text: 'Human-readable summary for the LLM / fallback hosts' }
  ],
  structuredContent: { /* plain object, not a bare array, for the widget */ }
})
```

Rules that matter:

- **Handler must be an async function** (or an ESM `default` export of one). `{ schema, handler }` shapes are **not** accepted.
- **No `require` of the MCP SDK in your handler.** The loader wires everything; you just return data.
- **Do not import `actions.json`** from your handler -- metadata is not your concern.
- Validate `args` yourself if your handler has invariants beyond the input schema (the schema lives in the UI; what it allows may be broader than what your code handles).
- **Never log secrets** (tokens, Authorization headers, PII). `console.log` output in I/O Runtime is retained.
- **Never execute dynamic code** (`eval`, `new Function`, dynamic `require(userInput)`). App Builder security rules forbid this.

### Step 3. Write tests

Open `test/actions/<action-name>.test.js` (scaffolded in Step 1) and replace the TODO with real assertions. **Always write tests before moving on** — they are the fastest feedback loop, faster than any `curl` or host integration.

Cover, at minimum:

- The happy path (typical valid args → expected `content[0].text`).
- Each meaningful branch: missing required arg, upstream API error, edge cases your handler actually handles.
- If the handler returns `structuredContent`: assert it's a **plain object**, not a bare array.

Rules that matter:

- **Handler tests live under `test/actions/`**, not next to the handler. Co-locating would let webpack bundle test files into `dist/index.js`. The scaffold script enforces this.
- Test the handler **in isolation** — import the function directly (`require('../../actions/<name>/index.js')`), call it with plain args, assert on the return value. No MCP server, no network.
- Mock external HTTP calls (`fetch`, `aio-lib-state`, etc.) — don't hit real APIs in unit tests.
- `test/server.test.js` already covers the MCP protocol and action-loader paths. Don't re-test those; just test your handler.

Run tests:

```bash
npx jest test/actions/<action-name>   # just this handler, fast
npm test                              # everything (handler units + server integration)
```

Iterate until tests pass. If you can't write a test for a behavior, that's usually a sign the handler is doing too much — refactor.

See [references/local-testing.md](references/local-testing.md#unit-test-your-handler) for more examples (widget cases, async mocking).

### Step 4. Populate `actions.json`

The scaffold already added a placeholder entry to `actions.json`. **Before smoke testing, add your actual input properties to `inputSchema.properties`** — without them, Zod strips every argument before it reaches your handler and all args will be empty:

```json
{
  "name": "my-action",
  "title": "My Action",
  "description": "TODO: set in the llm-apps UI",
  "inputSchema": {
    "type": "object",
    "properties": {
      "myParam": { "type": "string", "description": "..." }
    },
    "required": ["myParam"]
  }
}
```

In production, metadata (title, description, inputSchema, annotations) comes from the llm-apps UI. Once you've configured the action there, click **Download actions.json** on the Actions page and drop it at the repo root to replace the local placeholder.

### Step 5. Smoke test locally

Pick one of two modes:

```bash
npm run dev:local    # Plain Node.js HTTP server on :9080 — no Adobe credentials required
npm run dev          # Deploys to I/O Runtime via `aio app run` — prints a https:// URL
```

`dev:local` gives `http://localhost:9080`. `dev` prints a URL like `https://<ns>.adobeioruntime.net/api/v1/web/llm-apps/mcp`. Call that URL `<MCP_URL>` below. Verify the tool appears and responds:

```bash
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq '.result.tools[].name'
```

If it's in the list, call it:

```bash
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"<action-name>","arguments":{...}}}'
```

For a widget-enabled tool, point Claude Desktop, Cursor, or MCP Inspector at `<MCP_URL>` -- see [references/local-testing.md](references/local-testing.md).

Before shipping, run:

```bash
node .claude/skills/llm-apps-action-author/scripts/validate-handler.js actions/<action-name>/index.js
npm test
```

`validate-handler.js` checks the export shape and that a trivial call returns a valid `{ content, structuredContent? }` object. `npm test` runs every handler's unit tests plus `test/server.test.js` — both must pass.

## Return-shape contract

| Field | Required | Consumer | Shape |
|---|---|---|---|
| `content` | **Yes** | LLM / text-only hosts | Array of content parts, e.g. `[{ type: 'text', text: '...' }]` |
| `structuredContent` | No | Widget iframe | Plain object. **Not** a bare array -- wrap it: `{ items: [...] }` |

The LLM never sees `structuredContent`. The widget never sees `content` directly (it can call `window.openai.toolOutput` to read `structuredContent`). Always return `content` as the fallback; add `structuredContent` when you have a widget.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Tool not in `tools/list` | Handler export shape wrong -> `validate-handler.js`. Or `actions.json` entry missing -> re-download from UI. |
| Tool appears but description is the raw name | `actions.json` is absent -> filesystem-discovery fallback path. Download `actions.json`. |
| Widget doesn't render | (a) Both `widget.html` and EDS config exist -> `widget.html` wins; delete it if you want EDS. (b) Host CSP blocks your resource -> configure CSP domains in the UI. |
| "Skipping ..." warning on startup | Handler didn't export a function. Fix the module export. |
| Works locally, fails in prod | You edited `actions.json` by hand. The deploy pipeline overwrites it from the DB. Put the change in the UI. |

See [references/widget-patterns.md](references/widget-patterns.md) for CSP and postMessage details; [references/actions-json-schema.md](references/actions-json-schema.md) for the complete field reference.

## What's in this skill

```
.claude/skills/llm-apps-action-author/
├── SKILL.md                          # This file
├── references/
│   ├── actions-json-schema.md        # Every field in actions.json, with examples
│   ├── widget-patterns.md            # Custom HTML widget + MCP Apps JS API + CSP
│   ├── eds-widget.md                 # When to pick EDS and what gets generated
│   └── local-testing.md              # npm run dev, Inspector, Claude, Cursor
├── assets/
│   ├── handler-template.js             # Bare handler starter
│   ├── handler-with-widget-template.js # Handler returning content + structuredContent
│   ├── handler-test-template.js        # Jest test starter for a handler
│   └── widget-template.html            # Widget iframe starter
└── scripts/
    ├── scaffold-action.sh              # Zero-dep action scaffolder (handler + test + optional widget)
    └── validate-handler.js             # Zero-dep handler shape checker
```

Load references on-demand -- they exist so this file stays focused on the happy path.
