---
name: llm-apps-action-author
description: Create and edit LLM Apps actions end to end — the MCP tool handler in this Adobe I/O Runtime repo AND its EDS widget block in the app's companion EDS repo. Use when the user asks to "add an action", "implement my new action", "create an MCP tool", "scaffold a handler", "write a tool-only handler", "add a widget/block for my llm-app action", or is working in a repo derived from the llm-apps boilerplate (has an `actions/` directory, `entry.js`, and depends on `@adobe/llm-apps-runtime`). Starts from the action's Code identifier and input parameters configured in the llm-apps UI, produces a correctly shaped handler (content + structuredContent) with tests, a matching EDS block (`decorate(block, bridge)`), and guides the user through every step outside the code: creating the action in the llm-apps UI, publishing an EDS page that invokes the block, setting the widget URLs/CSP, deploying and testing. Covers local testing with `npm run dev:local` and the EDS block preview harness.
metadata:
  author: Adobe llm-apps
  version: 0.3.0
  mcp-server: llm-apps
---

# llm-apps-action-author

Author actions for apps built on the **llm-apps boilerplate** (Adobe I/O Runtime). This skill keeps you on the happy path: correct handler shape, correct return contract, a widget block that reads that contract, correct local test loop, and a clear hand-off of the steps only the user can do.

## What an LLM App is (30-second model)

An LLM App is an MCP server that LLM hosts (ChatGPT, Claude, Gemini, ...) call. Each **action** is one MCP tool. An app has **two git repos**:

| Repo | Contains | Per action |
|---|---|---|
| Handler repo (this one) | `actions/<id>/index.js` running on I/O Runtime | handler + `test/actions/<id>.test.js` |
| EDS repo (usually a sibling folder named `<this-repo>-eds`) | AEM Edge Delivery site; widgets are EDS blocks | `blocks/<id>/<id>.js` + `.css` |

Plus the **llm-apps UI**, which owns the action metadata (name, Code identifier, description, input parameters, annotations, widget type and URLs, CSP), and the **EDS content source**, which holds the page that invokes the block.

At runtime: the host calls the tool → the handler returns `content` (text for the model) and `structuredContent` (data for the widget) → the host loads the widget page from the Widget URL via `aem-embed.js` → the block's `decorate(block, bridge)` reads `structuredContent` from `bridge.toolResult` and renders it.

## When to use this skill

Trigger on phrases like:

- "add an action to my llm-app"
- "create an MCP tool for llm-apps"
- "scaffold a handler"
- "add a widget for this action" / "create the block for my action"
- "I created action `<id>` in the UI, write its handler"
- "why isn't my tool showing up?"
- Any repo whose root contains `entry.js`, an `actions/` directory, and depends on `@adobe/llm-apps-runtime` (server core is the runtime package, not in-repo).

This skill ships only in the handler repo, but it also writes into the app's EDS repo (see Step 0).

Do **not** use this skill for:

- Adobe Commerce actions, AEM custom apps, or non-boilerplate App Builder projects.
- Authoring tool **metadata** (name, description, input schema, annotations, visibility, CSP). That lives in the llm-apps UI, not in code. If the user tries to edit metadata here, redirect them with the exact UI steps ([references/user-guide.md](references/user-guide.md#4-when-the-user-asks-to-change-metadata)).

## The split-ownership model (read this first)

The boilerplate intentionally splits concerns:

| Concern | Where it lives | Who edits |
|---|---|---|
| Tool metadata (title, description, inputSchema, annotations, visibility, CSP, widget type + URLs) | llm-apps UI (DB) -> `actions.json` in production via the deploy pipeline | Product / UX / anyone with UI access |
| Tool logic (handler code, optional custom widget.html) | This repo | You |
| Widget block (`blocks/<id>/`) | EDS repo | You |
| Page invoking the block | EDS content source (published page) | The user |

**You never hand-edit metadata in code.** The developer's loop is:

1. Create the action in the UI (Code identifier + parameters).
2. Optionally click **Download actions.json** on the Actions page -> drop it at the repo root (otherwise the scaffold writes a local placeholder).
3. Write the handler here and, for widget actions, the block in the EDS repo.
4. `npm run dev:local` (zero Adobe credentials) or `npm run dev` (deploys to I/O Runtime) -> test -> `git push` both repos.
5. Publish the EDS page and set the widget URLs in the UI (user).

The deploy pipeline then writes a fresh `actions.json` from the DB and builds.

If the user asks you to "set the description of my tool", "add CSP domains", or "change the inputSchema" -- **tell them where to do it in the UI** ([user-guide §3](references/user-guide.md#4-when-the-user-asks-to-change-metadata)), then re-download `actions.json`.

The runtime forwards only allowlisted protocol metadata, not internal authoring
fields. Widget links and security schemes are runtime-generated. Global
`quickAction` and `settings` entrypoints are unsupported and dropped. See the
[schema reference](references/actions-json-schema.md#tool-meta) before suggesting metadata.

## Decision tree: which action shape?

```
Does the result need a visual UI beyond text?
 ├─ No  -> tool-only. Handler returns { content }. Widget type in UI: "No interactive UI".
 │         scaffold-action.sh <id>
 ├─ Yes, EDS block (DEFAULT for LLM Apps; every generated action uses it)
 │       -> handler returns { content, structuredContent }
 │          + block blocks/<id>/ in the EDS repo + page invoking it (user)
 │          + Widget type "Edge Delivery Services block" in the UI (user).
 │          scaffold-action.sh <id> --eds  +  scaffold-eds-block.sh <id> <eds-repo>
 └─ Yes, self-contained custom HTML (only if the user asks; no EDS involved)
         -> actions/<id>/widget.html next to index.js. It overrides any EDS config.
            scaffold-action.sh <id> --widget
```

If the user doesn't say, ask whether the action has a widget; if it does, use the EDS block.
A missing handler is not "widget-only": the deploy registers a default stub, so always write one.

## Happy-path workflow

For any new action, follow these steps in order. Use the scaffold scripts to avoid manual file creation.

### Step 0. Collect the inputs

The action must exist in the llm-apps UI first: its Code identifier is fixed there. **If the user hasn't created it (or doesn't know the identifier), send them the walkthrough in [references/user-guide.md §1](references/user-guide.md#1-create-the-action-in-the-llm-apps-ui) and wait.** Don't invent an identifier and start coding.

You need, from the user:

| Input | Example | Notes |
|---|---|---|
| **Code identifier** | `savings-calculator` | Shown under the action name in the UI; fixed after creation. It is the handler folder name, the MCP tool name, and the EDS block name. Not the display name. |
| **Input parameters** | `amount: number, required` | Name, type (String/Number/Integer/Boolean/Object/File), required, description. May be none. A *File* parameter arrives as `{ name, resourceUri }`: pass it as `--param <name>:object` and read it with `getFileInput(args)` from `@adobe/llm-apps-runtime` (see `actions/open_csv`). |
| **Widget?** | EDS block / none / custom HTML | See decision tree. |
| **What it should do** | data source, API, or "dummy for now" | Ask if unclear; don't invent business logic. |
| **EDS repo path** (if widget) | `../<this-repo>-eds` | Look for a sibling folder containing `blocks/` and `scripts/aem-embed.js`; confirm with the user before writing into it. |

Also ask for the action's **Description** and review it with [user-guide §3](references/user-guide.md#3-writing-the-action-description): it is what the AI uses to decide whether to call the action. Propose a rewrite if it is vague, broader than what the handler does, or overlaps sibling actions; the user pastes it into the UI.

If the user gives a display name ("Savings calculator"), derive the identifier the way the UI does (lowercase, spaces to hyphens) and confirm it. Ask for anything missing in one question at a time; don't guess parameters.

### Step 1. Scaffold the handler

From the handler repo root:

```bash
S=.claude/skills/llm-apps-action-author/scripts
bash $S/scaffold-action.sh <id>                                        # tool-only
bash $S/scaffold-action.sh <id> --eds --param amount:number:required   # EDS widget (default)
bash $S/scaffold-action.sh <id> --widget                               # custom widget.html
```

`--param name:type[:required]` (repeatable) seeds the local `actions.json` inputSchema so arguments reach the handler during local testing. Types: `string|number|integer|boolean|object|array`.

The script validates the identifier and creates:

- `actions/<id>/index.js` from `assets/handler-template.js` (or `handler-with-widget-template.js` with `--eds` / `--widget`)
- `actions/<id>/widget.html` from `assets/widget-template.html`, **only** with `--widget`
- `test/actions/<id>.test.js` from `assets/handler-test-template.js` (always — never skip the test file)
- `test/fixtures/<id>/example.json`: `{ "arguments": { ... } }` with typed placeholders. Replace them with realistic values; the test and `check-action.js` both use them.
- a local placeholder entry in `actions.json`

### Step 2. Write the handler

Open `actions/<id>/index.js` and replace the TODOs. The contract is:

```js
module.exports = async (args = {}, extra) => ({
  content: [
    { type: 'text', text: 'Human-readable summary for the LLM / fallback hosts' }
  ],
  structuredContent: { /* plain object, not a bare array, for the widget */ }
})
```

`args` holds the UI-declared parameters (keys = parameter names). `extra` carries
`extra.authInfo` (verified caller, only for `requiresAuth` actions) and `extra.variables`
(app variables from the UI); both may be `undefined` locally, so degrade gracefully. See the
README sections "Auth in actions" and "Variables & secrets in actions".

Correctness rules (these are what make a handler work first time in a real host):

- **Default `args`** (`args = {}`) and treat every parameter as possibly missing, even required ones: hosts can call with partial args.
- **Check types** of the args you use (`typeof`, `Number.isFinite`); the UI schema may be looser than your code.
- **Invalid input or upstream failure** -> return `isError: true` with a clear `content` text, instead of throwing, when the model can recover (e.g. ask the user for a value).
- **Keep `structuredContent` the same shape on every branch** (success, empty, error): same top-level keys, empty arrays instead of missing keys. The block renders whatever arrives.
- **Never return `undefined`/`null` fields the block doesn't expect**; prefer `null` only for documented optional values.
- **Deterministic for the same args** unless the action is inherently live (APIs). Put timeouts on network calls (`AbortSignal.timeout(8000)`) and only map approved fields from upstream responses into `structuredContent`.
- **Text in `content` must stand alone** for hosts that don't render widgets, and must not repeat everything the widget shows.

Platform rules:

- **Handler must be an async function** (or an ESM `default` export of one). `{ schema, handler }` shapes are **not** accepted.
- **No `require` of the MCP SDK in your handler.** The loader wires everything; you just return data.
- **Do not import `actions.json`** from your handler -- metadata is not your concern.
- The runtime appends shared UI guidance as an `additionalInstructions` JSON text block through `tools/call`; do not add a generic UI-instruction wrapper. Keep app-specific guidance. Direct handler tests bypass this enrichment.
- Validate `args` yourself if your handler has invariants beyond the input schema (the schema lives in the UI; what it allows may be broader than what your code handles).
- **Never log secrets** (tokens, Authorization headers, PII). `console.log` output in I/O Runtime is retained.
- **Never execute dynamic code** (`eval`, `new Function`, dynamic `require(userInput)`). App Builder security rules forbid this.

### Step 3. Write tests

Open `test/actions/<id>.test.js` (scaffolded in Step 1) and replace the TODO with real assertions. **Always write tests before moving on** — they are the fastest feedback loop, faster than any `curl` or host integration.

Cover, at minimum:

- The happy path with `example.arguments` (typical valid args → expected `content[0].text`).
- Each meaningful branch: missing required arg, upstream API error, edge cases your handler actually handles.
- If the handler returns `structuredContent`: assert its **exact shape** (keys + types) on the happy path **and** on error/empty branches. This is the contract the block depends on.

Rules that matter:

- **Handler tests live under `test/actions/`**, not next to the handler. Co-locating would let webpack bundle test files into `dist/index.js`. The scaffold script enforces this.
- Test the handler **in isolation** — import the function directly (`require('../../actions/<name>/index.js')`), call it with plain args, assert on the return value. No MCP server, no network.
- Mock external HTTP calls (`fetch`, `aio-lib-state`, etc.) — don't hit real APIs in unit tests.
- `test/server.test.js` already covers the MCP protocol and action-loader paths. Don't re-test those; just test your handler.

Run tests:

```bash
npx jest test/actions/<id>   # just this handler, fast
npm test                     # everything (handler units + server integration)
```

`npm test` also runs `test/server.test.js`, which discovers action folders from disk and restores your local `actions.json` afterwards. If `npm test` was already failing before your change, report the pre-existing failures to the user instead of silently fixing unrelated tests.

Iterate until tests pass. If you can't write a test for a behavior, that's usually a sign the handler is doing too much — refactor.

See [references/local-testing.md](references/local-testing.md#unit-test-your-handler) for more examples (widget cases, async mocking).

### Step 4. Check the local `actions.json`

The scaffold added a placeholder entry to the local, gitignored `actions.json` (from `--param`). **Before smoke testing, make sure `inputSchema.properties` lists every parameter** — without them, Zod strips every argument before it reaches your handler and all args will be empty:

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
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"<id>","arguments":{...}}}'
```

For a widget-enabled tool, point Claude Desktop, Cursor, or MCP Inspector at `<MCP_URL>` -- see [references/local-testing.md](references/local-testing.md).

### Step 6. Scaffold and implement the EDS block (widget actions only)

```bash
bash .claude/skills/llm-apps-action-author/scripts/scaffold-eds-block.sh <id> <eds-repo-path>
```

Creates `blocks/<id>/<id>.js` and `.css` in the EDS repo. Then:

1. Set `PREVIEW_RESULT` to the handler's real output for `example.arguments` (copy it from `handler(example.arguments).structuredContent`). `check-action.js` fails if their shapes differ.
2. Make `render()` read exactly those fields. Handle the empty/error shape (empty arrays, `isError` responses) with an explicit empty state.
3. Keep the template's guards: `bridge?.` (a plain EDS page view calls `decorate(block)` with no bridge), `live` only when connected and not `hostContext.preview`, `try/catch` around `await bridge.toolResult`, `bridge.autoResize(block)` when connected.
4. Render tool data with `createElement` + `textContent` only; never `innerHTML` with data. Scope all CSS under `.<id>`.
5. Follow the EDS repo's `AGENTS.md` (vendored `scripts/aem.js`, `scripts/aem-embed.js`, `scripts/llmapps-sdk.js` are read-only; imports only from `/scripts/`; no build step).
6. Preview with `npx -y @adobe/aem-cli up` and `http://localhost:3000/tools/widget-preview.html?block=<id>`; run `npm run lint` in the EDS repo.

Contract, bridge API and security rules: [references/eds-widget.md](references/eds-widget.md).

### Definition of done (run before handing off)

Every command must pass. Don't report success otherwise.

```bash
# handler repo
node .claude/skills/llm-apps-action-author/scripts/check-action.js <id> [--eds <eds-repo>]
npx jest test/actions/<id>
npm test
npm run lint
# EDS repo (widget actions)
npm run lint
```

`check-action.js` is the end-to-end gate: handler shape (via `validate-handler.js`), test file present, handler runs with `example.json`, local `actions.json` declares every argument, and for the EDS block: exists under the identifier, parses, `decorate(block, bridge)` signature, reads the tool result, guards a missing bridge, no HTML-injection, CSS scoped, no overriding `widget.html`, and **`PREVIEW_RESULT` (and `blocks/<id>/<id>.json` if present) has the same shape as the handler's `structuredContent`**. It auto-detects the sibling `../<repo>-eds`. If the handler needs the network, pass `--args` that works offline or rely on the mocked Jest tests.

### Step 7. Hand off to the user (always)

Finish with the hand-off message from [references/user-guide.md §2](references/user-guide.md#2-hand-off-message-after-the-code-is-done), for the matching action type, **with every placeholder filled in** (identifier, EDS owner/repo from `git remote get-url origin`, page path, exact Script/Widget URLs, CSP origins, an example prompt). For widget actions it covers:

1. Push and merge both repos.
2. Create and publish the EDS page that invokes the block (one-column table with header `<id>`, at `/eds-widgets/<id>-demo` like generated actions), and check it renders.
3. In the llm-apps UI > **Actions** > `<id>` > **LLM Widget details**: widget type, widget domain, widget description, Script URL, Widget URL, CSP; **Save changes**.
4. Deploy to Stage, test in ChatGPT or Claude, then promote to Production.

The widget doesn't show in any host until the user completes steps 2–4, so never end with just "done".

## Return-shape contract

| Field | Required | Consumer | Shape |
|---|---|---|---|
| `content` | **Yes** | LLM / text-only hosts | Array of content parts, e.g. `[{ type: 'text', text: '...' }]` |
| `structuredContent` | No | Clients and widgets; model visibility depends on the host | Plain object. **Not** a bare array -- wrap it: `{ items: [...] }` |

Do not assume `structuredContent` is hidden from the model; never put secrets in
it. EDS blocks read it from `bridge.toolResult`, custom widgets from `app.toolResult`
(`@adobe/llmapps-sdk`); never `window.openai` (ChatGPT-only). Always return `content`
as the fallback; add `structuredContent` when clients or widgets need structured
data. Protocol consumers must tolerate the runtime's extra instruction content
block; the original handler data remains intact.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Tool not in `tools/list` | Handler export shape wrong -> `validate-handler.js`. Or `actions.json` entry missing -> re-download from UI. |
| Tool appears but description is the raw name | `actions.json` is absent -> filesystem-discovery fallback path. Download `actions.json`. |
| Widget doesn't render | (a) Both `widget.html` and EDS config exist -> `widget.html` wins; delete it if you want EDS. (b) Host CSP blocks your resource -> configure CSP domains in the UI. (c) EDS page not published, or its block name differs from `blocks/<id>/`. (d) Script/Widget URL missing in the UI. |
| Widget shows preview/sample data in the host | Block always renders `PREVIEW_RESULT`: check the `live` condition reads `bridge.toolResult`. |
| Widget renders but is empty | Block reads fields the handler doesn't return. Align `structuredContent` and `render()`. |
| "Skipping ..." warning on startup | Handler didn't export a function. Fix the module export. |
| `Cannot find module '.../@modelcontextprotocol/sdk/dist/cjs/server/mcp'` in plain `node` | `@adobe/llm-apps-runtime` < 1.8.2. Upgrade the runtime (`npm i @adobe/llm-apps-runtime@^1.8.2`). |
| Works locally, fails in prod | You edited `actions.json` by hand. The deploy pipeline overwrites it from the DB. Put the change in the UI. |

See [references/widget-patterns.md](references/widget-patterns.md) for CSP and postMessage details; [references/actions-json-schema.md](references/actions-json-schema.md) for the complete field reference.

## What's in this skill

```
.claude/skills/llm-apps-action-author/
├── SKILL.md                          # This file
├── references/
│   ├── actions-json-schema.md        # Every field in actions.json, with examples
│   ├── widget-patterns.md            # Custom widget.html + @adobe/llmapps-sdk API + CSP
│   ├── user-guide.md                 # What to tell the user: UI action setup + hand-off message
│   ├── eds-widget.md                 # EDS block contract, preview, page + UI hand-off
│   └── local-testing.md              # npm run dev, Inspector, Claude, Cursor
├── assets/
│   ├── handler-template.js             # Bare handler starter
│   ├── handler-with-widget-template.js # Handler returning content + structuredContent
│   ├── handler-test-template.js        # Jest test starter for a handler
│   ├── eds-block-template.js           # EDS widget block starter (decorate(block, bridge))
│   ├── eds-block-template.css          # EDS widget block styles (light/dark)
│   └── widget-template.html            # Custom widget.html starter
└── scripts/
    ├── scaffold-action.sh              # Zero-dep action scaffolder (handler + test + optional widget)
    ├── scaffold-eds-block.sh           # Zero-dep EDS block scaffolder (writes into the EDS repo)
    ├── check-action.js                 # End-to-end gate: handler + test + block contract
    └── validate-handler.js             # Zero-dep handler shape checker
```

Load references on-demand -- they exist so this file stays focused on the happy path.
