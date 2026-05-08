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
 * Local development server.
 *
 * Wraps the webpack bundle (dist/index.js) in a plain Node.js HTTP server so
 * you can run without Adobe I/O Runtime or any cloud credentials.
 *
 *   node server/local.js          # default port 9080
 *   PORT=4000 node server/local.js
 *
 * The MCP endpoint will be:
 *   http://localhost:<PORT>
 *
 * The HTTP server logic lives in @adobe/llm-apps-runtime (createLocalServer)
 * so it's versioned alongside the rest of the runtime.
 */

const path = require('path')
// Uses the /local subpath (not the package root) so we don't transitively
// load the MCP SDK here — the SDK is ESM-only and Node's CJS loader can't
// resolve it. It only works bundled by webpack (dist/index.js below).
const { createLocalServer, parseParamArgs } = require('@adobe/llm-apps-runtime/local')

// The webpack bundle (dist/index.js) resolves ESM/CJS interop for the MCP SDK.
// Run `npm run build` (or `npm run dev:local` which does it automatically) before starting.
const distPath = path.resolve(__dirname, '..', 'dist', 'index.js')
const { main } = require(distPath)

// Parse --param KEY=VALUE flags from the command line (same grammar as aio app deploy --param).
// These are injected into every request's params, simulating Adobe I/O Runtime action params locally.
//
// Example:
//   node server/local.js \
//     --param LLMA_ANALYTICS_URL=http://localhost:8080/v1/analytics/ingest \
//     --param LLMA_ANALYTICS_APP_ID=my-app \
//     --param LLMA_ANALYTICS_KEY=<hex>
const extraParams = parseParamArgs(process.argv)
createLocalServer(main, process.env.PORT || 9080, extraParams)
