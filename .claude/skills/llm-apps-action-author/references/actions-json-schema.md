# `actions.json` schema reference

`actions.json` is the source of truth for tool registration. The llm-apps UI is the only supported authoring surface for these fields; the deploy pipeline materializes them into this file in production. Locally, developers download it from the UI.

This file is **gitignored**. Do not hand-edit it.

## Top-level shape

```json
{
  "actions": [
    { "name": "...", "title": "...", /* ... */ },
    { /* ... */ }
  ]
}
```

## Per-action fields

### Required

| Field | Type | Notes |
|---|---|---|
| `name` | string | Kebab-case, `[a-z0-9-]+`. Becomes the MCP tool name and the directory name under `actions/`. |

### Strongly recommended

| Field | Type | Purpose |
|---|---|---|
| `title` | string | Human-readable label shown by hosts. Falls back to `name`. |
| `description` | string | Shown to the LLM when choosing tools. Keep it action-oriented ("Fetches ...", not "A tool that fetches ..."). |
| `inputSchema` | JSON Schema object | The argument contract. Must be `type: "object"` with `properties`. Converted to Zod by the loader. |
| `annotations` | object | MCP tool hints (`readOnlyHint`, `idempotentHint`, `destructiveHint`, `openWorldHint`). |
| `icons` | array | Navigation icons exposed in `tools/list`; each requires a string `src`, with optional `mimeType`, `sizes` and `theme` (`light` or `dark`). Not part of `tool_meta` or tool-call results. |

### Widget-related

| Field | Type | Purpose |
|---|---|---|
| `widget_type` | `"EDS"` or omitted | If `"EDS"`, the loader generates an `<aem-embed>` template for the widget resource. Ignored when a `widget.html` file exists in the action directory. |
| `eds_widget.script_url` | string | URL to the AEM Edge Delivery `aem-embed.js` script. |
| `eds_widget.widget_embed_url` | string | URL the `<aem-embed>` element loads. |
| `eds_widget.bundled_html` | string | Written by the deploy pipeline, never by hand: the EDS widget with its JavaScript inlined, served only to Gemini. |
| `tool_meta` | object | Stored configuration projected onto the tool's allowlisted `_meta` fields. See [Tool meta](#tool-meta). |
| `resource_meta` | object | Stored configuration projected onto the widget resource's allowlisted `_meta` fields. See [Resource meta](#resource-meta). |

### Supported `inputSchema` types

The loader's JSON-Schema-to-Zod converter handles:

- `type: "string"` (optionally with `enum`)
- `type: "number"`, `type: "integer"`
- `type: "boolean"`
- `type: "array"` with `items`
- `description` on any property

Anything else degrades to `z.any()`. Add a richer schema in the UI if you need stricter validation.

## Tool meta

Only supported protocol fields reach the tool's MCP `_meta` block. Internal
authoring fields (such as `concept`, `preview_prompt` and `output_schema`) are not
forwarded; unknown fields and malformed values are logged by field name only.
See the runtime's [metadata allowlist](https://github.com/Adobe-AIFoundations/llm-apps-runtime#forwarded-metadata-allowlist)
for the complete contract. Commonly used keys:

```json
"tool_meta": {
  "ui": {
    "visibility": ["model", "app"]
  },
  "openai/fileParams": ["attachments"],
  "openai/toolInvocation/invoking": "Thinking ...",
  "openai/toolInvocation/invoked": "Done.",
  "openai/widgetAccessible": true
}
```

The loader generates `_meta.ui.resourceUri`, `ui/resourceUri`,
`openai/outputTemplate` and `openai/resultCanProduceWidget` for registered widgets,
and `securitySchemes` from app authentication. Stored copies cannot override
them. Only `visibility` is configurable under `tool_meta.ui`; file parameter
names belong in the top-level `openai/fileParams` array, not `ui.fileParams`.

`openai/ui` supports `global`, `thread` and `file` entrypoints. The removed
`settings` entrypoint and unsupported global `quickAction` are logged and dropped;
valid sibling entrypoints remain.

## Resource meta

Goes into the widget resource's `_meta` block. Commonly used keys:

```json
"resource_meta": {
  "csp": {
    "connectDomains": ["https://api.example.com"],
    "resourceDomains": ["https://cdn.example.com"]
  },
  "permissions": ["camera"],
  "domain": "https://example.com",
  "prefersBorder": true
}
```

- `csp.connectDomains`: hosts the widget iframe may `fetch`/`XHR`/`WebSocket` to. Always list every domain or the host will block the call.
- `csp.resourceDomains`: hosts for `<img>`, `<script>`, `<link>` sources.
- `permissions`: browser permission names (`camera`, `microphone`, ...) the widget needs.
- `domain`: origin hint used by some hosts for iframe sandbox policy. Note: for the Claude host this field is ignored — the runtime auto-derives `ui.domain` as a SHA-256 subdomain of the MCP server URL (`{hash}.claudemcpcontent.com`), which is what Claude requires. The value here is only used by non-Claude hosts.
- `prefersBorder`: whether the host should render a chrome around the iframe.

The loader wraps these under `_meta.ui.*` and attaches them to the widget resource
content, not to the tool. Only `csp`, `permissions`, `domain` and `prefersBorder`
may be flat or nested under `resource_meta.ui`; nested values win per field, and
CSP domains are merged. `csp.redirectDomains` instead maps to
`_meta["openai/widgetCSP"].redirect_domains`. `widgetDescription` and `openai/ui`
display metadata must be at the `resource_meta` top level.

## Full example

```json
{
  "actions": [
    {
      "name": "weather-lookup",
      "title": "Weather Lookup",
      "description": "Fetches current weather for a city.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name" },
          "units": { "type": "string", "enum": ["metric", "imperial"], "description": "Unit system" }
        },
        "required": ["city"]
      },
      "annotations": { "readOnlyHint": true, "idempotentHint": true },
      "widget_type": "EDS",
      "eds_widget": {
        "script_url": "https://example.aem.page/scripts/aem-embed.js",
        "widget_embed_url": "https://example.aem.page/eds-widgets/weather"
      },
      "resource_meta": {
        "csp": {
          "connectDomains": ["https://api.openweather.example.com"],
          "resourceDomains": ["https://example.aem.page"]
        },
        "prefersBorder": true
      },
      "tool_meta": {
        "ui": { "visibility": ["model", "app"] },
        "openai/toolInvocation/invoking": "Checking the weather ..."
      }
    }
  ]
}
```
