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

// Reference example for reading a declared app variable/secret. Declaring
// GREETING_PREFIX (name + type) is done in the llm-apps UI; see "Variables &
// secrets in actions" in the README.
module.exports = async (args, extra) => {
    const prefix = extra?.variables?.GREETING_PREFIX || 'Hello'

    // For a secret-typed variable (e.g. an upstream API key), read it the
    // same way and forward it as a header — never log or return it raw:
    //   const res = await fetch(url, { headers: { Authorization: `Bearer ${extra.variables.UPSTREAM_API_KEY}` } })

    return {
        content: [
            {
                type: 'text',
                text: `${prefix}, ${args.name}!`
            }
        ]
    }
}
