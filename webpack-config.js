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
 * Custom webpack configuration for Adobe I/O CLI builds.
 *
 * The aio CLI searches for files matching *webpack-config.{js,cjs} starting
 * from the action path and walking up to the project root. This file is picked
 * up automatically and merged with the CLI's default webpack config.
 *
 * We add a single rule: import .html files as raw strings (asset/source).
 * This is required for inlining widget.html files into the server bundle.
 */
module.exports = {
    module: {
        rules: [
            {
                test: /\.html$/,
                type: 'asset/source'
            }
        ]
    }
}
