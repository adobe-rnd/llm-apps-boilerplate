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
 * Webpack entry point for the MCP Apps server.
 *
 * This file is the only place where webpack's require.context API is called.
 * It builds the action module map and widget HTML map at compile time
 * (relative to THIS file, so paths always resolve to this project's actions/)
 * then passes them to createMain from @adobe/llm-apps-runtime.
 *
 * Changing the entry in webpack.config.js from server/index.js to this file
 * is what lets the runtime live in a separate package: require.context paths
 * are resolved at compile time relative to the file they appear in.
 */

const { createMain } = require('@adobe/llm-apps-runtime')

// webpack resolves these at compile time relative to this file's directory.
// The resulting context objects are passed to the runtime — it never calls
// require.context itself, so it remains a plain Node/npm package.
const moduleContext = require.context('./actions', true, /index\.js$/)
const htmlContext   = require.context('./actions', true, /widget\.html$/)

let actionsConfig = {}
try { actionsConfig = require('./actions.json') } catch (e) { /* no actions.json at build time */ }

module.exports = createMain({ moduleContext, htmlContext, actionsConfig })
