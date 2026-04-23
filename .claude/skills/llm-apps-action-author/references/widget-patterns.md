# Custom HTML widget patterns

Use a custom `widget.html` when the widget needs interactive behaviour that doesn't fit an AEM Edge Delivery page. The file must be **self-contained**: inline `<style>` and `<script>`, no webpack imports, no external bundlers.

When a `widget.html` exists in `actions/<name>/`, it takes priority over any EDS config.

## Minimum viable widget

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; padding: 12px; }
    </style>
  </head>
  <body>
    <div id="root">Loading ...</div>
    <script>
      (async () => {
        const root = document.getElementById('root');
        try {
          const output = await window.openai.toolOutput;
          root.textContent = JSON.stringify(output, null, 2);
        } catch (err) {
          root.textContent = 'No tool output available.';
        }
      })();
    </script>
  </body>
</html>
```

## The `window.openai` / MCP Apps JS API

The host injects a bridge object into the widget iframe. The most useful members:

| Member | Purpose |
|---|---|
| `window.openai.toolOutput` | Promise resolving to the `structuredContent` object your handler returned. |
| `window.openai.callTool(name, args)` | Invoke another tool on the same server. Useful for refresh / drill-down. |
| `window.openai.sendFollowupTurn(text)` | Queue a new user turn in the conversation. |
| `window.openai.setWidgetState(state)` / `getWidgetState()` | Persist small bits of UI state across re-renders. |
| `window.openai.requestDisplayMode(mode)` | Request `inline` / `fullscreen` / `pip`. Hosts may deny. |

Refer to the [MCP Apps JS API](https://modelcontextprotocol.github.io/ext-apps/api/documents/JS_API.html) for the full surface.

## Handler <-> widget contract

```js
// actions/my-tool/index.js
module.exports = async (args) => {
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

```html
<!-- actions/my-tool/widget.html -->
<script>
  (async () => {
    const { items, generatedAt } = await window.openai.toolOutput;
    render(items, generatedAt);
  })();
</script>
```

**Never** return a bare array from `structuredContent`. Wrap it in an object (e.g. `{ items: [...] }`). Some hosts serialize differently for top-level arrays.

## CSP

Widgets run in a sandboxed iframe with a strict Content Security Policy. Every outbound `fetch`, `img src`, `script src`, or `link` must be whitelisted by the host.

You configure CSP in the **llm-apps UI** (`resource_meta.csp`), not in `widget.html`. Fields:

- `connectDomains`: hosts for `fetch` / `XHR` / `WebSocket`.
- `resourceDomains`: hosts for `<img>`, `<script>`, `<link>`.

Forgetting to list a domain is the single most common cause of "the widget is blank". Check the browser devtools console in the host for `Refused to connect to ...` errors.

## What not to do

| Anti-pattern | Why it breaks |
|---|---|
| `<script src="./bundle.js">` | The widget is inlined as a single string at build time; there is no relative file system. Inline all scripts. |
| Loading React/Vue from npm | Same reason. Use CDN links (still needs `resourceDomains`) or vanilla JS. |
| Reading cookies / localStorage to persist state | The iframe origin may be ephemeral. Use `window.openai.setWidgetState`. |
| Calling your own handler by hitting the MCP URL directly | CORS + auth will bite you. Use `window.openai.callTool(name, args)`. |
| Returning secrets in `structuredContent` | It's rendered in the host's DOM and can leak to extensions. Strip sensitive fields. |
| Executing strings as code (`eval`, `new Function(userInput)`) | Forbidden by the CSP and by security policy. |

## Local development

When you have a `widget.html` file:

1. `npm run dev:local` (no Adobe credentials) or `npm run dev` (deploys to I/O Runtime).
2. Open MCP Inspector or Claude Desktop pointing at the printed URL.
3. Invoke the tool. The widget should render.
4. To iterate on widget CSS/JS: edit the file and restart the dev script. Webpack inlines the HTML at build time, so changes require a rebuild (`npm run dev:local` rebuilds on each start).
