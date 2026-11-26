# Custom HTML widget patterns

Use a custom `widget.html` when the widget needs interactive behaviour that doesn't fit an AEM Edge Delivery page. The file must be **self-contained**: inline `<style>` and `<script>`, no webpack imports, no external bundlers.

When a `widget.html` exists in `actions/<name>/`, it takes priority over any EDS config.

## Data and host API: `@adobe/llmapps-sdk`

Use the SDK from inside the widget; it implements the MCP Apps protocol for every host
(ChatGPT, Claude, Gemini, ...). **Do not use `window.openai`** directly: it exists only in
ChatGPT, so the widget would be empty everywhere else. `assets/widget-template.html` and
`actions/open_csv/widget.html` show the full pattern.

```html
<script type="module">
  import { createApp } from "https://esm.sh/@adobe/llmapps-sdk@0.2.1";

  const app = await createApp({ appInfo: { name: "my-tool", version: "1.0.0" } });
  const result = await app.toolResult;          // { content, structuredContent, isError? }
  render(result.structuredContent);
  app.onToolResult((r) => render(r.structuredContent));  // later calls
  app.autoResize(document.body);
</script>
```

`createApp()` returns the same object an EDS block receives as `bridge`:

| Member | Purpose |
|---|---|
| `app.toolResult` | Promise of the first tool result; read `.structuredContent` |
| `app.onToolResult(cb)` | Every later tool result |
| `app.hostContext` / `app.onContextChange(cb)` | Theme, locale, display mode |
| `app.callTool(name, args)` | Invoke another action on the same server (refresh / drill-down) |
| `app.sendMessage(text)` | Send a follow-up user message |
| `app.updateModelContext(input)` | Give the model context without a new message |
| `app.openLink(url)` | Open a link through the host |
| `app.requestDisplayMode(mode)` | Request `inline` / `fullscreen` / `pip`; hosts may deny |
| `app.autoResize(el)` | Keep the iframe sized to the content |

Full typed surface: `scripts/llmapps-sdk.d.ts` in the EDS repo, or the
[`@adobe/llmapps-sdk`](https://www.npmjs.com/package/@adobe/llmapps-sdk) package.

## Handler <-> widget contract

```js
// actions/my-tool/index.js
module.exports = async (args = {}) => {
  const data = await fetchSomething(args)
  return {
    content: [
      { type: 'text', text: `Summary for the LLM / text hosts: ${data.summary}` }
    ],
    structuredContent: {
      items: data.items,
      generatedAt: new Date().toISOString()
    }
  }
}
```

The widget reads `result.structuredContent.items` and `.generatedAt`. Keep the shape identical on
error/empty branches.

**Never** return a bare array from `structuredContent`. Wrap it in an object (e.g. `{ items: [...] }`). Some hosts serialize differently for top-level arrays.

## CSP

Widgets run in a sandboxed iframe with a strict Content Security Policy. Every outbound `fetch`, `img src`, `script src`, or `link` must be whitelisted by the host.

You configure CSP in the **llm-apps UI** (`resource_meta.csp`), not in `widget.html`. Add `https://esm.sh` to `resourceDomains` for the SDK import. Fields:

- `connectDomains`: hosts for `fetch` / `XHR` / `WebSocket`.
- `resourceDomains`: hosts for `<img>`, `<script>`, `<link>`.

Forgetting to list a domain is the single most common cause of "the widget is blank". Check the browser devtools console in the host for `Refused to connect to ...` errors.

## What not to do

| Anti-pattern | Why it breaks |
|---|---|
| `<script src="./bundle.js">` | The widget is inlined as a single string at build time; there is no relative file system. Inline all scripts. |
| Loading React/Vue from npm | Same reason. Use CDN links (still needs `resourceDomains`) or vanilla JS. |
| Reading cookies / localStorage to persist state | The iframe origin may be ephemeral and sandboxed. Keep state in the tool result or call another action. |
| Calling your own handler by hitting the MCP URL directly | CORS + auth will bite you. Use `app.callTool(name, args)`. |
| Using `window.openai.*` | ChatGPT-only. Use `@adobe/llmapps-sdk`. |
| Returning secrets in `structuredContent` | It's rendered in the host's DOM and can leak to extensions. Strip sensitive fields. |
| Executing strings as code (`eval`, `new Function(userInput)`) | Forbidden by the CSP and by security policy. |

## Local development

When you have a `widget.html` file:

1. `npm run dev:local` (no Adobe credentials) or `npm run dev` (deploys to I/O Runtime).
2. Open MCP Inspector or Claude Desktop pointing at the printed URL.
3. Invoke the tool. The widget should render.
4. To iterate on widget CSS/JS: edit the file and restart the dev script. Webpack inlines the HTML at build time, so changes require a rebuild (`npm run dev:local` rebuilds on each start).
