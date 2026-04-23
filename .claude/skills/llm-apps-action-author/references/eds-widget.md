# EDS widgets

EDS = AEM Edge Delivery Services. An EDS widget renders an AEM-authored page inside the MCP widget iframe via the `<aem-embed>` custom element.

## When to pick EDS

Pick EDS when:

- The widget content lives in AEM and is authored by a non-developer (content/marketing team).
- You want the widget to update without shipping new code.
- The visuals match an existing AEM-published page or fragment.

Do **not** pick EDS when:

- The widget has interactive logic driven by `structuredContent`. EDS pages are generally static.
- You need tight coupling between the tool's output and the widget's UI.
- You need custom CSP beyond script/connect domains (custom HTML gives more control).

## UI fields you configure

In the llm-apps UI for the action:

| Field | Purpose |
|---|---|
| `widget_type` | Set to `EDS` |
| `eds_widget.script_url` | URL to the AEM Edge Delivery `aem-embed.js` script |
| `eds_widget.widget_embed_url` | URL the `<aem-embed>` element loads |
| `resource_meta.csp.connectDomains` | At minimum, the origin of `widget_embed_url` |
| `resource_meta.csp.resourceDomains` | Same origin + any CDN the EDS page loads from |

Both URLs must be served over HTTPS. The pipeline will reject `http://` URLs.

## What the loader generates

Given the UI config, the loader synthesizes this `widget.html`:

```html
<script src="<script_url>" type="module"></script>
<div>
    <aem-embed url="<widget_embed_url>"></aem-embed>
</div>
```

It then registers a `ui://<name>/widget.html` resource with `mimeType: text/html;profile=mcp-app` and attaches the `resource_meta` you configured under `_meta.ui`.

You do **not** create any file locally for EDS widgets. No `widget.html` file. If you accidentally create one, it will win over the EDS config (widget.html file > EDS config > no widget) -- delete it.

## Fallback behavior

If `widget_type: "EDS"` is set but `eds_widget.script_url` or `eds_widget.widget_embed_url` is missing, the loader prints a warning and registers the tool with **no** widget. The tool still works as a tool-only action.

Check your server logs on `npm run dev` for:

```
⚠ EDS widget for "<name>": missing script_url or widget_embed_url in eds_widget config
```

If you see this, go back to the UI and fill in both URLs, then re-download `actions.json`.

## Handler contract for EDS widgets

An EDS widget has no built-in way to consume `structuredContent` -- the AEM page is just HTML. If the EDS page needs data from the tool call, the page script has to call back into the MCP server via `window.openai.callTool(...)`. In practice, most EDS widgets are pure-display and the handler is a no-op:

```js
module.exports = async () => ({
  content: [{ type: 'text', text: 'Rendered in widget.' }],
  structuredContent: {}
})
```

Or the action has no handler folder at all and registers via the default handler.
