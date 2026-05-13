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
 * Echo action handler.
 *
 * Tool-only (no widget). Returns the caller's message as text.
 * Tool metadata (title, description, inputSchema, annotations) lives in the
 * llm-apps UI and is materialized into actions.json at build time.
 *
 * @param {string} message - The message to echo back.
 */

module.exports = async ({ message = 'No message provided' }) => ({
    content: [
        {
            type: 'text',
            text: `Echo: ${message}`
        }
    ]
})
