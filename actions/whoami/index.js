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
 * whoami action handler.
 *
 * Tool-only (no widget). Reference example for auth-protected actions.
 *
 * Gating this action so it actually requires auth is done in the llm-apps UI,
 * not here: set `requiresAuth: true` (and any `scopes`) on this action, and
 * enable + configure the app's top-level auth block (issuer, JWKS URI,
 * resource, scopes). Metadata is authored and owned by the UI -- this file
 * only owns the logic. See the "Auth in actions" section of the README.
 */

module.exports = async (args, extra) => {
    // The runtime verifies the caller's bearer token (signature, issuer,
    // audience, expiry) BEFORE your handler ever runs, and forwards the
    // result here as `extra.authInfo`. It's only present when this action has
    // requiresAuth: true AND the app's auth block is enabled -- both
    // UI-configured. If either isn't set, authInfo is undefined, same as an
    // unauthenticated call to a public tool.
    const sub = extra?.authInfo?.extra?.sub

    // extra.authInfo.token is the caller's own raw bearer token. Forward it
    // as a normal Bearer Authorization header to call another API *as the
    // authenticated user* rather than as the app itself -- e.g.:
    //
    //   const res = await fetch(upstreamUrl, {
    //       headers: { Authorization: `Bearer ${extra.authInfo.token}` }
    //   })
    //
    // Never log or return the raw token (or any header containing it) --
    // it's a live credential, and console.log output on I/O Runtime is retained.

    return {
        content: [
            {
                type: 'text',
                text: sub ? `user:${sub}` : 'unknown'
            }
        ]
    }
}
