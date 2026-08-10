# Adobe LLM Apps boilerplate

Starter repo for building [Adobe LLM Apps](#) — AI tools with optional interactive widgets — on Adobe I/O Runtime. Implements the [Model Context Protocol](https://modelcontextprotocol.io/) so tools render in any MCP-compatible host (Claude, Cursor, ChatGPT, …).

Built on the official [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) with the [MCP Apps extension](https://modelcontextprotocol.github.io/ext-apps/api/documents/Overview.html). The server runtime lives in the standalone [`@adobe/llm-apps-runtime`](https://www.npmjs.com/package/@adobe/llm-apps-runtime) package — this repo is the thin scaffold around it.

## The developer contract

You write **handlers only**. Everything else — tool name, description, input schema, annotations, widget visibility, permissions, CSP — lives in the Adobe LLM Apps UI and is materialized into `actions.json` by the deploy pipeline.

- **Metadata** → authored in the UI, stored in the DB.
- **Handler code** → authored in this repo, deployed from your branch.
- **Local dev** → download `actions.json` from the UI to mirror production exactly.

You never hand-edit metadata in this repo, never register a tool in code, never re-publish the UI to change a description.

## Quick start

```bash
npm install
npm run dev:local
```

`dev:local` builds with webpack and starts a plain Node.js HTTP server on `http://localhost:9080`. No Adobe credentials required — use this for 95% of handler iteration.

```
  LLM Apps local server running
  Endpoint: http://localhost:9080
```

Point Claude Desktop, Cursor, or MCP Inspector at that URL. See [Connecting a host](#connecting-a-host).

To deploy to Adobe I/O Runtime instead, see [Running on Adobe I/O Runtime](#running-on-adobe-io-runtime).

## Workflow

```
1. Write handler       actions/<name>/index.js
2. Download config     Actions page → Download actions.json (mirrors prod)
3. Run locally         npm run dev:local
4. Ship it             git push → deploy pipeline builds & deploys
```

### 1. Write a handler

```js
// actions/weather-lookup/index.js
module.exports = async ({ city }) => {
  const { temperatureC } = await fetchWeather(city)
  return {
    content: [
      { type: 'text', text: `${city}: ${temperatureC}°C` }
    ],
    structuredContent: { city, temperatureC }
  }
}
```

A handler is a plain async function. It receives the tool's `arguments` object and must return `{ content, structuredContent? }`. See [`content` vs `structuredContent`](#content-vs-structuredcontent).

### 2. Download `actions.json`

On the Actions page of your app in the LLM Apps UI, click **Download actions.json** and drop the file at the repo root. This is the exact same payload the deploy pipeline writes in production.

`actions.json` is gitignored — it's per-developer local state, not part of the repo. If you skip this step, handlers still register (with empty metadata) but you won't see the real title, description, input schema, or widget behavior configured in the UI.

### 3. Run locally

```bash
npm run dev:local
```

Restart after handler changes — webpack inlines everything into `dist/index.js` at build time.

### 4. Ship it

```bash
git push origin your-branch
```

The deploy pipeline clones your repo, fetches the latest metadata from the API, writes `actions.json`, runs `npm install && npm run build`, and deploys to I/O Runtime. You don't build or deploy manually.

## Authoring with Claude (optional)

This repo ships a Claude skill at [`.claude/skills/llm-apps-action-author/`](.claude/skills/llm-apps-action-author/SKILL.md) that automates steps 1 and 4. Claude Code and Cursor auto-discover it when you open this repo.

### What it does

- Scaffolds handler + optional `widget.html` from templates.
- Validates the handler export shape and return contract.
- Redirects you back to the UI whenever you try to edit metadata in code.
- Explains widget resolution (`widget.html` > EDS config > tool-only).

### Example prompts

- **Scaffold a tool-only action.**
  > "Add a new action called `currency-convert` that takes `amount`, `from`, `to` and returns the converted amount as text."

- **Scaffold an action with a custom HTML widget.**
  > "Scaffold a new action `weather-lookup` with a widget. The handler should return a short text summary plus structured data for the widget."

- **Fill in a handler you already scaffolded.**
  > "Implement the handler in `actions/currency-convert/index.js`. It should call `https://api.exchangerate.host/convert` and return the converted amount. Don't hand-edit `actions.json`."

- **Validate before shipping.**
  > "Run the skill's `validate-handler.js` against every file under `actions/*/index.js` and tell me what fails."

- **Debug a tool that isn't appearing.**
  > "My `echo` tool isn't showing up in the Inspector. Use the skill's troubleshooting guide to figure out why."

- **Refuse metadata edits in code.**
  > "Change the description of my `weather-lookup` tool to 'Look up current weather by city'."

  The skill will redirect you to the LLM Apps UI instead of editing `actions.json`.

### CLI-only usage (without Claude)

The skill's scripts are zero-dependency and usable from any shell:

```bash
# Create actions/weather-lookup/index.js + widget.html from templates
bash .claude/skills/llm-apps-action-author/scripts/scaffold-action.sh weather-lookup --widget

# Sanity-check a handler's export shape and return contract
node .claude/skills/llm-apps-action-author/scripts/validate-handler.js actions/weather-lookup/index.js
```

## Widget cases

| Case | Handler | Widget source | Authored in |
|---|---|---|---|
| Tool only | required | — | handler code + UI metadata |
| EDS widget | optional | `widget_type: "EDS"` + `eds_widget` in `actions.json` | UI only |
| Custom HTML widget | optional | `actions/<name>/widget.html` | handler code + `widget.html` file + UI metadata |

**Resolution priority** (checked in order):

1. `widget.html` file in the action directory
2. EDS config in `actions.json`
3. No widget (tool-only)

### Tool only

Just a handler, no widget file, no EDS config. The tool returns text; the host shows that text inline.

### EDS widget

No local file needed. Configure `widget_type: "EDS"` and `eds_widget.script_url` + `eds_widget.widget_embed_url` in the UI; the loader generates an `<aem-embed>` template automatically. Use this when the widget is an AEM Edge Delivery page.

### Custom HTML widget

When you need a fully custom, self-contained widget, drop a `widget.html` file next to your `index.js`. It's inlined into the `ui://<name>/widget.html` resource at build time. The file must be self-contained — use inline `<script>` blocks, not external bundles that need webpack to resolve. See the [MCP Apps examples](https://modelcontextprotocol.github.io/ext-apps/api/documents/Examples.html) for the postMessage contract between your widget and the host.

During local dev you can round-trip a custom widget without the UI: the `widget.html` you commit wins over any EDS config.

## Auth in actions

Same split as everything else: **whether** an action requires auth lives in the UI, **how your handler uses the token** lives in code. See `actions/whoami/index.js` for a working reference.

In the llm-apps UI, per action you can set:

- `requiresAuth: true` — this action needs a valid, verified token before your handler runs.
- `scopes: [...]` — a token must carry all of these to reach your handler.

And at the app level, an `auth` block (issuer, JWKS URI, resource, supported scopes) that describes the identity provider you're trusting. Both are UI-only concerns — nothing to configure in this repo.

When both are set, the runtime verifies the caller's bearer token (signature, issuer, audience, expiry) **before** your handler ever runs, and forwards the result as the handler's second argument:

```js
module.exports = async (args, extra) => {
    const authInfo = extra?.authInfo
    // {
    //   token: '<raw bearer token>',
    //   clientId: '<client_id/azp claim>',
    //   scopes: ['orders:read', ...],
    //   expiresAt: <unix seconds>,
    //   resource: '<verified audience>',
    //   extra: { sub: '<subject claim>', ...other allow-listed claims }
    // }
}
```

If the action isn't `requiresAuth: true`, or the app's `auth` block isn't enabled, `authInfo` is simply `undefined` — treat that as "no identity available," not an error.

**Reading the caller's identity** — safe to use directly (`authInfo.extra.sub`, `authInfo.clientId`, `authInfo.scopes`).

**Calling another API as the caller** — forward `authInfo.token` as a normal Bearer header, exactly like a browser would:

```js
const response = await fetch(upstreamUrl, {
    headers: { Authorization: `Bearer ${authInfo.token}` }
})
```

Rules that matter here specifically:

- **Never log or return the raw token** (or any header containing it) — it's a live credential, and `console.log` output on I/O Runtime is retained.
- Missing/insufficient auth is enforced by the runtime **before** your handler runs — you don't need to re-check `requiresAuth`/`scopes` yourself.
- Locally (`npm run dev:local`), without a real IdP wired into your `actions.json`'s `auth` block, `authInfo` will always be `undefined` — write your handler to degrade gracefully (see `whoami`'s fallback message), and cover both branches in your tests. `test/actions/whoami.test.js` shows how: hand-construct an `extra.authInfo` object shaped like the real thing, no MCP server or real token needed.

## Variables & secrets in actions

Same split again: declaring a variable (name, and type `string` or `secret`) is done in the llm-apps UI; reading it is your handler's job. See `actions/greet/index.js` for a working reference.

Once declared and deployed, the runtime forwards every variable into the handler's second argument as `extra.variables`, keyed by name — `string` and `secret` types surface identically, nothing in code distinguishes them:

```js
module.exports = async (args, extra) => {
    const prefix = extra?.variables?.GREETING_PREFIX || 'Hello'
}
```

**Never log or return a `secret`-typed value** — same rule as `authInfo.token` above.

Locally (`npm run dev:local`), simulate declared variables with `--param` flags (the same mechanism already used for `LLMA_ANALYTICS_*`):

```bash
node server/local.js \
  --param 'LLMA_VARIABLE_NAMES=["GREETING_PREFIX"]' \
  --param GREETING_PREFIX=Howdy
```

Without those flags, `extra.variables` is `undefined` and `greet` falls back to its default greeting — degrade gracefully, same as `authInfo`.

## `content` vs `structuredContent`

| | `content` | `structuredContent` |
|---|---|---|
| Consumer | LLM / text-only hosts | Widget iframe |
| Format | `[{ type: 'text', text: '...' }]` | Plain object (NOT a bare array) |
| Token cost | Counts against the context window | Zero (not sent to LLM) |

Always return `content` — it's the fallback for hosts that don't render widgets. Add `structuredContent` only when you have a widget that needs data.

## Connecting a host

Start the server (`npm run dev:local` or `npm run dev`), grab the printed URL, and plug it into your host as `<MCP_URL>`.

### curl

```bash
# List tools
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Call the echo tool
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

Both headers are required — the MCP streamable-http transport rejects other combinations.

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Transport Type = `streamable-http`, URL = `<MCP_URL>`.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "llm-apps-local": {
      "transport": {
        "type": "streamable-http",
        "url": "<MCP_URL>"
      }
    }
  }
}
```

Restart Claude Desktop. Tools appear under the plug icon.

### Cursor

Add to `~/.cursor/mcp.json` (or your workspace `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "llm-apps-local": {
      "url": "<MCP_URL>"
    }
  }
}
```

## Testing

```bash
npm test                       # all tests (handler units + server integration)
npx jest test/actions/echo     # only the echo handler tests
```

### Handler unit tests

Handler tests live in `test/actions/`, mirroring the `actions/` structure. Keeping tests outside `actions/` is load-bearing — webpack bundles everything under `actions/` into `dist/index.js`, so co-locating tests would ship them to I/O Runtime.

```
test/
└── actions/
    └── echo.test.js   # tests actions/echo/index.js
```

Copy `test/actions/echo.test.js` to test your own handlers in isolation — no MCP server, no network:

```js
// test/actions/my-action.test.js
const handler = require('../../actions/my-action/index.js')

test('returns expected text', async () => {
  const out = await handler({ city: 'London' })
  expect(out.content[0].text).toContain('London')
})
```

### Integration tests

`test/server.test.js` exercises the full request stack — action loading, MCP protocol, tool calls, resource reads. Use the developer integration test at the bottom of that file as a template for testing actions end-to-end:

```js
const path = require('path')
const { createMain } = require('@adobe/llm-apps-runtime')

const { main } = createMain({ actionsDir: path.join(__dirname, '..', 'actions') })

test('weather-lookup returns temperature', async () => {
  const res = await main({
    __ow_method: 'post',
    __ow_body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'weather-lookup', arguments: { city: 'London' } }
    }),
    __ow_headers: {
      'content-type': 'application/json',
      accept: 'application/json;q=1.0, text/event-stream;q=0.5'
    },
    LOG_LEVEL: 'info'
  })
  expect(JSON.parse(res.body).result.content[0].text).toContain('°C')
})
```

## Project layout

```
your-llm-app/
├── entry.js                   # Webpack entry — require.context + createMain invocation
├── actions/                   # Your handler directories (deployable files only)
│   ├── echo/
│   │   └── index.js           # Handler (plain async function)
│   ├── whoami/
│   │   └── index.js           # Handler reading extra.authInfo — see "Auth in actions"
│   └── greet/
│       └── index.js           # Handler reading extra.variables — see "Variables & secrets in actions"
├── test/
│   ├── actions/
│   │   ├── echo.test.js       # Handler unit tests (mirrors actions/ layout)
│   │   ├── whoami.test.js     # Same, but hand-builds extra.authInfo — no real IdP needed
│   │   └── greet.test.js      # Same, but hand-builds extra.variables — no deploy pipeline needed
│   ├── fixtures/actions.json  # Test config
│   └── server.test.js         # Server integration tests
├── server/
│   └── local.js               # Local dev HTTP server (no Adobe credentials)
├── actions.json               # Gitignored; download from UI or written by deploy pipeline
├── app.config.yaml            # I/O Runtime config (action name, memory, timeout)
├── webpack.config.js
└── package.json
```

## How action discovery works

`actions.json` is the source of truth for which tools get registered. For each entry, the loader looks for `actions/<name>/index.js`; if it exists, that module is the handler (it must export an async function). If the folder is missing, the tool still registers with a default handler that returns empty content — useful for widget-only actions. Widgets are resolved by checking for `widget.html` first, then falling back to the EDS template if `widget_type: "EDS"` is set. If `actions.json` is missing entirely (local dev before you've downloaded it), the loader falls back to scanning `actions/` and registers each handler with empty metadata, printing a banner so you notice.

The runtime logic lives in [`@adobe/llm-apps-runtime`](https://www.npmjs.com/package/@adobe/llm-apps-runtime). `entry.js` is the thin layer that calls webpack's `require.context` (compile-time path resolution) and passes the resulting maps to `createMain`. You don't touch `entry.js` unless you rename the `actions/` directory.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev:local` | Build + start a plain Node.js server on `http://localhost:9080` (no `aio` login). |
| `npm run dev` | `aio app run` — deploys to your I/O Runtime namespace and prints a public HTTPS URL. Requires `aio app use`. |
| `npm run build` | Webpack → `dist/index.js`. |
| `npm run deploy` | Build + `aio app deploy`. In practice the pipeline handles this. |
| `npm test` | Jest — handler units + server integration. |
| `npm run lint` / `format` | ESLint / Prettier over `actions/`. |

## Running on Adobe I/O Runtime

One-time: link this repo to a Console workspace.

```bash
aio app use           # interactive: pick org / project / workspace
```

That writes `.env` (runtime namespace + auth key) and `.aio` (project context). Both are gitignored.

Then:

```bash
npm run dev           # aio app run — deploys and prints a URL like
                      # https://<namespace>.adobeioruntime.net/api/v1/web/llm-apps/mcp
```

Use that URL as `<MCP_URL>` in [Connecting a host](#connecting-a-host). It changes per namespace — never hard-code it.

## License

See [LICENSE](LICENSE).
