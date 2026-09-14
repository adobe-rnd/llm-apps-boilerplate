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
 * search_mentions — composer @-mention provider example (OpenAI/Codex MCP
 * extensions).
 *
 * Enable "Composer mentions" for this action in the Adobe LLM Apps UI (ChatGPT
 * Extensions tab) — that sets tool_meta["openai/extensions"]["mentions/search"].
 * The host then calls this tool from the composer picker with:
 *   { query: string }   // may be empty
 * and expects:
 *   structuredContent.items: Array<{ type: 'resource', resourceUri, title,
 *                                    subtitle?, icons? }>
 *
 * When a user selects a result, the host adds a reference to its resourceUri to
 * the message. Register the referenced resources on your MCP server so the host
 * can resolve them.
 *
 * Tool metadata lives in the llm-apps UI and is materialized into actions.json.
 */

// A tiny in-memory catalog stands in for a real search backend.
const CATALOG = [
    { id: 'APP-1', title: 'APP-1 Login page flickers' },
    { id: 'APP-2', title: 'APP-2 Slow checkout on mobile' },
    { id: 'APP-3', title: 'APP-3 Export to CSV fails' }
]

module.exports = async ({ query = '' } = {}) => {
    const needle = query.trim().toLowerCase()
    const items = CATALOG
        .filter((row) => needle === '' || row.title.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle))
        .map((row) => ({
            type: 'resource',
            resourceUri: `mcp://issues/${row.id}`,
            title: row.title
        }))

    return {
        content: [],
        structuredContent: { items }
    }
}
