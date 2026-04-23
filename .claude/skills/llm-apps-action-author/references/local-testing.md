# Local testing

Two separate things to test:

1. **The handler in isolation** (pure function, no MCP machinery): `validate-handler.js` or `jest`.
2. **The tool end-to-end** (MCP + widget resolution + host rendering): `npm run dev` + a client.

## Start the local server

Two options:

### Option A: `npm run dev:local` (no Adobe credentials)

```bash
npm install
npm run dev:local
```

Starts a plain Node.js HTTP server (no `aio app run`, no I/O Runtime deploy):

```
  LLM Apps local server running
  Endpoint: http://localhost:9080
```

Best for fast iteration. Override the port with `PORT=4000 npm run dev:local`.

### Option B: `npm run dev` (deploys to I/O Runtime)

```bash
npm install
aio app use        # one-time: select workspace
npm run dev
```

`aio app run` prints a URL like:

```
> Your deployed actions:
> https://<namespace>.adobeioruntime.net/api/v1/web/llm-apps/mcp
```

That URL is the MCP endpoint. It changes per user/namespace -- never hard-code it.

If `actions.json` is missing, you will see a banner in the log:

```
┌─────────────────────────────────────────────────────────────────────┐
│  No actions.json found.                                             │
│  Handlers will be registered with empty metadata.                   │
│  Download actions.json from the llm-apps UI to mirror production.   │
└─────────────────────────────────────────────────────────────────────┘
```

Download `actions.json` from the Actions page in the UI before testing anything metadata-dependent (descriptions, inputSchema validation, widgets).

## Verify with curl

Use the endpoint URL everywhere below as `<MCP_URL>`.

```bash
# List tools
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq

# Call a tool
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"<NAME>","arguments":{...}}}' | jq

# Read a widget resource (if the tool has a widget)
curl -sX POST "<MCP_URL>" \
  -H 'content-type: application/json' \
  -H 'accept: application/json;q=1.0, text/event-stream;q=0.5' \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"ui://<NAME>/widget.html"}}' | jq
```

Both `content-type: application/json` and `accept: application/json;q=1.0, text/event-stream;q=0.5` headers are required; the MCP SDK's streamable-http transport rejects other combinations.

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI:

- Transport Type: `streamable-http`
- URL: `<MCP_URL>`
- Click Connect

You get a real UI for listing tools, calling them with forms built from the inputSchema, seeing the widget rendered, and inspecting the raw JSON-RPC frames. This is the fastest feedback loop for widget work.

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. Tools appear under the plug icon in the composer. Widgets render inline.

## Cursor

Edit `~/.cursor/mcp.json` (or the workspace's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "llm-apps-local": {
      "url": "<MCP_URL>"
    }
  }
}
```

## Unit-test your handler

Your handler is a plain async function. Test it directly:

```js
// test/actions/weather-lookup.test.js
const handler = require('../../actions/weather-lookup/index.js')

describe('weather-lookup', () => {
  test('returns a text summary and structured content', async () => {
    const out = await handler({ city: 'Bucharest' })

    expect(out.content[0].type).toBe('text')
    expect(out.content[0].text).toMatch(/Bucharest/)
    expect(typeof out.structuredContent).toBe('object')
    expect(Array.isArray(out.structuredContent)).toBe(false)
  })
})
```

Run:

```bash
npm test
```

Jest picks up `test/**/*.test.js` via the boilerplate's `jest.config.js`. Keep handler tests under `test/actions/` (not co-located with the handler) so webpack doesn't accidentally bundle them into `dist/index.js`.

## Pre-flight checklist (before `git push`)

- [ ] Handler exports a plain async function (run `validate-handler.js`)
- [ ] Handler returns `content` always; `structuredContent` when there's a widget
- [ ] Widget HTML is self-contained (no `src="./..."`)
- [ ] `npm test` passes
- [ ] `npm run dev:local` (or `npm run dev`) shows the tool in `tools/list`
- [ ] For widgets: the host renders without CSP errors (check devtools)
- [ ] No secrets in `console.log`, no hardcoded tokens
