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
 * The optional _meta["openai/resource"].path is untrusted client metadata,
 * not a path on Adobe I/O Runtime or proof of authorization. Never use it
 * directly for filesystem access or return it to the widget.
 *
 * The widget (widget.html) reads the file via the host using file.resourceUri
 * and can write it back with the SDK's writeResource(). This handler just
 * surfaces the file info for the initial render. File I/O is host-managed;
 * application-owned mutations should use a normal authenticated action.
 *
 * Tool metadata (title, description, inputSchema, entrypoints) lives in the
 * llm-apps UI and is materialized into actions.json at build time.
 */

const { getFileInput } = require('@adobe/llm-apps-runtime')

module.exports = async (args) => {
    const file = getFileInput(args)
    if (!file) {
        return {
            isError: true,
            content: [{ type: 'text', text: 'No file was provided to open.' }]
        }
    }

    return {
        content: [{ type: 'text', text: `Opened ${file.name}` }],
        structuredContent: { file }
    }
}
