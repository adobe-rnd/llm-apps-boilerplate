# EDS widgets

EDS = AEM Edge Delivery Services. An LLM App's EDS widget is an **EDS block** that lives in
the app's **EDS repo** (a separate git repo, usually a sibling named `<handler-repo>-eds`),
placed on a published EDS page. The LLM host loads that page through `scripts/aem-embed.js`,
which renders the block and passes it an MCP bridge carrying the handler's `structuredContent`.

```
handler repo                          EDS repo                         EDS content (DA / SharePoint)
actions/<id>/index.js   ──tool──▶     blocks/<id>/<id>.js + .css  ◀──  page containing a "<id>" block
returns structuredContent             decorate(block, bridge)          URL = Widget URL in the UI
```

Three pieces, three owners:

| Piece | Where | Who |
|---|---|---|
| Handler (`content` + `structuredContent`) | handler repo `actions/<id>/index.js` | developer (this skill) |
| Block (renders `structuredContent`) | EDS repo `blocks/<id>/<id>.{js,css}` | developer (this skill) |
| Page invoking the block + widget config | EDS content source + llm-apps UI | **user** (cannot be done from code) |

## Naming

The block name **must equal the action's Code identifier** (`<id>`). The page invokes the block
by name, and `aem-embed.js` loads `/blocks/<id>/<id>.js` and `/blocks/<id>/<id>.css`.

## Block contract

```js
export default async function decorate(block, bridge) { ... }
```

Bridge members used by blocks (full surface: `scripts/llmapps-sdk.d.ts` and the header of
`scripts/aem-embed.js` in the EDS repo):

| Member | Purpose |
|---|---|
| `bridge.isConnected` | `true` when running inside a host |
| `bridge.hostContext` | `theme`, `locale`, `displayMode`, ...; `preview === true` in the preview harness |
| `bridge.toolResult` | Promise of the first tool result; read `.structuredContent` |
| `bridge.onToolResult(cb)` | Every tool result, for widgets reused across calls |
| `bridge.onContextChange(cb)` | Theme / display changes |
| `bridge.autoResize(el)` | Keeps the host iframe sized to the block |
| `bridge.callTool(name, args)` | Call another action from the widget |
| `bridge.sendMessage(text)` | Send a follow-up user message |
| `bridge.openLink(url)` | Open a link through the host |

Canonical pattern (used by every generated block in the EDS repo and by
`assets/eds-block-template.js`):

```js
const PREVIEW_RESULT = { /* sample structuredContent */ };

export default async function decorate(block, bridge) {
  const connected = bridge?.isConnected === true;
  const live = connected && bridge.hostContext?.preview !== true;
  let result = PREVIEW_RESULT;
  if (live) {
    try {
      result = (await bridge.toolResult)?.structuredContent || {};
    } catch (e) {
      result = {};
    }
  }
  render(block, result);
  if (connected) bridge.autoResize(block);
}
```

Rules:

- The block's expected shape **is** the handler's `structuredContent` shape. Change both together.
- Keep `PREVIEW_RESULT` shaped like real `structuredContent`; it is what authors see in preview.
- Render values with `textContent` / `createElement`, never `innerHTML` with tool data.
- Handle the empty state (`{}` or empty arrays): the handler may return no data.
- Scope CSS under `.<id>`; support `[data-theme="dark"]`.
- No imports other than `/scripts/...` (EDS repo `AGENTS.md`). No build step.
- Gemini serves a deploy-time bundled copy of the widget JS (`eds_widget.bundled_html`), so
  block JS changes reach Gemini only after the next app deploy.

## Preview the block locally (no page needed)

From the EDS repo:

```bash
npx -y @adobe/aem-cli up
open "http://localhost:3000/tools/widget-preview.html?block=<id>"
npm run lint
```

`tools/widget-preview.html` mounts the block with a preview bridge
(`hostContext.preview === true`), so it renders `PREVIEW_RESULT`.

## What the user must do

Publishing the page, setting the widget URLs/CSP in the UI and deploying are done by the user.
Send them the filled-in hand-off message from [user-guide.md §2](user-guide.md#2-hand-off-message-after-the-code-is-done).
The repo's `content/<id>-demo.plain.html` files show the page markup but are **not** published content.

## What the runtime generates

From the UI config the loader synthesizes the widget resource (`ui://<id>/widget.html`,
`mimeType: text/html;profile=mcp-app`):

```html
<script src="<script_url>" type="module"></script>
<div>
    <aem-embed url="<widget_embed_url>"></aem-embed>
</div>
```

Do **not** create `actions/<id>/widget.html` for an EDS action: a `widget.html` file wins over
the EDS config (widget.html > EDS config > no widget). Use `scaffold-action.sh --eds`, not `--widget`.

If `widget_type: "EDS"` is set but either URL is missing, the loader logs

```
⚠ EDS widget for "<name>": missing script_url or widget_embed_url in eds_widget config
```

and registers the tool with no widget.
