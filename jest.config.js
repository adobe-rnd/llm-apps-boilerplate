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
 * Jest Configuration for MCP Apps Template
 */

module.exports = {
    testEnvironment: 'node',

    testMatch: [
        '**/test/**/*.test.js',
        '**/test/**/*.spec.js'
    ],

    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],

    collectCoverageFrom: [
        'server/**/*.js',
        'actions/**/*.js',
        '!server/**/dist/**',
        '!server/**/node_modules/**'
    ],

    setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],

    moduleDirectories: ['node_modules', '<rootDir>'],

    testTimeout: 30000,

    verbose: true,

    clearMocks: true,

    errorOnDeprecated: true,

    transform: {
        '^.+\\.js$': 'babel-jest',
        // Import .html files as raw strings in tests (mirrors webpack asset/source)
        '\\.html$': '<rootDir>/test/html-transform.js'
    }
}
