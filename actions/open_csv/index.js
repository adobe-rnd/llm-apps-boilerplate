/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * open_csv — file extension handler example (OpenAI/Codex MCP extensions).
 *
 * Declare a `file` UI entrypoint for this action in the Adobe LLM Apps UI
 * (ChatGPT Extensions tab -> Entrypoints -> File, extensions: .csv). When a user
 * opens a matching file in ChatGPT/Codex desktop, the host calls this tool with
 *   { file: { name, resourceUri } }
 * and injects the trusted server-side filesystem path in
 *   _meta["openai/resource"].path
 * which the host never exposes to the sandboxed widget iframe.
 *
 * The widget (widget.html) reads the file via the host using file.resourceUri
 * and can write it back with the SDK's writeResource(). This handler just
 * surfaces the file info + a preview for the initial render.
 *
 * Tool metadata (title, description, inputSchema, entrypoints) lives in the
 * llm-apps UI and is materialized into actions.json at build time.
 */

const { getFileInput, getTrustedPath } = require('@adobe/llm-apps-runtime')

module.exports = async (args, extra) => {
    const file = getFileInput(args)
    if (!file) {
        return {
            content: [{ type: 'text', text: 'No file was provided to open.' }]
        }
    }

    // The trusted path is server-side only (never returned to the widget). Use
    // it if you need to read sibling files or enforce a filesystem policy.
    const trustedPath = getTrustedPath(extra)

    return {
        content: [{ type: 'text', text: `Opened ${file.name}` }],
        structuredContent: {
            file,
            // Do NOT put trustedPath in structuredContent in a real app — it
            // would leak the host path to the iframe. Shown here only to
            // illustrate that the handler (server-side) can see it.
            hasTrustedPath: Boolean(trustedPath)
        }
    }
}
