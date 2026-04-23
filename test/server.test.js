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
 * Test suite for MCP Apps Server.
 *
 * Two modes exercised against the single real handler that ships (echo) plus
 * two config-only fixtures (empty-tool, eds-demo):
 *   - Mode A: with actions.json (config drives registration; full metadata).
 *   - Mode B: without actions.json (filesystem discovery; empty metadata).
 */

const fs = require('fs')
const path = require('path')
const { createMain } = require('@adobe/llm-apps-runtime')

const ACTIONS_DIR = path.join(__dirname, '..', 'actions')
const ACTIONS_JSON_PATH = path.resolve(__dirname, '..', 'actions.json')
const FIXTURES_ACTIONS = path.resolve(__dirname, 'fixtures', 'actions.json')

// resolveActions runs once at createMain() time (cold-start model), so actions.json
// must be installed/removed BEFORE calling createMain — not between requests.
function makeMain () {
    return createMain({ actionsDir: ACTIONS_DIR, serverName: 'llm-apps-poc' }).main
}

function mcpPost (main, body) {
    return main({
        __ow_method: 'post',
        __ow_body: JSON.stringify(body),
        __ow_headers: {
            'content-type': 'application/json',
            accept: 'application/json;q=1.0, text/event-stream;q=0.5'
        },
        LOG_LEVEL: 'info'
    })
}

function installActionsJson () {
    fs.copyFileSync(FIXTURES_ACTIONS, ACTIONS_JSON_PATH)
}

function removeActionsJson () {
    try { fs.unlinkSync(ACTIONS_JSON_PATH) } catch (e) { /* ignore */ }
}

// Shared main for tests that don't depend on actions.json content.
// Created without actions.json so it doesn't interfere with other describe blocks.
removeActionsJson()
const main = makeMain()

describe('MCP Apps Server', () => {
    describe('Health Check', () => {
        test('GET returns healthy status', async () => {
            const result = await main({
                __ow_method: 'get',
                __ow_path: '/',
                LOG_LEVEL: 'info'
            })

            expect(result.statusCode).toBe(200)
            expect(result.headers['Content-Type']).toBe('application/json')

            const body = JSON.parse(result.body)
            expect(body.status).toBe('healthy')
            expect(body.server).toBe('llm-apps-poc')
            expect(body.version).toBe('1.0.0')
        })
    })

    describe('CORS Support', () => {
        test('OPTIONS returns permissive CORS preflight headers', async () => {
            const result = await main({
                __ow_method: 'options',
                LOG_LEVEL: 'info'
            })

            expect(result.statusCode).toBe(200)
            expect(result.headers['Access-Control-Allow-Origin']).toBe('*')
            expect(result.headers['Access-Control-Allow-Methods']).toContain('POST')
        })
    })

    describe('With actions.json', () => {
        let withMain

        beforeAll(() => {
            installActionsJson()
            withMain = makeMain()
        })
        afterAll(() => removeActionsJson())

        describe('MCP Protocol', () => {
            test('initialize succeeds with server info', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {},
                        clientInfo: { name: 'test-client', version: '1.0.0' }
                    }
                })

                expect(result.statusCode).toBe(200)
                const body = JSON.parse(result.body)
                expect(body.jsonrpc).toBe('2.0')
                expect(body.id).toBe(1)
                expect(body.result.protocolVersion).toBe('2024-11-05')
                expect(body.result.serverInfo.name).toBe('llm-apps-poc')
            })

            test('tools/list includes every fixture entry', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'tools/list',
                    params: {}
                })

                expect(result.statusCode).toBe(200)
                const body = JSON.parse(result.body)
                const names = body.result.tools.map(t => t.name)

                expect(names).toEqual(expect.arrayContaining(['echo', 'empty-tool', 'eds-demo']))
                expect(names).toHaveLength(3)
            })

            test('tool metadata comes from actions.json (description, schema, annotations)', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'tools/list',
                    params: {}
                })

                const body = JSON.parse(result.body)
                const echo = body.result.tools.find(t => t.name === 'echo')

                expect(echo.description).toBe('A simple utility that echoes back the input message.')
                expect(echo.inputSchema.properties.message.type).toBe('string')
                expect(echo.inputSchema.required).toEqual(['message'])
                expect(echo.annotations.readOnlyHint).toBe(true)
                expect(echo.annotations.idempotentHint).toBe(true)
            })

            test('tool-only action has no _meta.ui', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 4,
                    method: 'tools/list',
                    params: {}
                })

                const body = JSON.parse(result.body)
                const echo = body.result.tools.find(t => t.name === 'echo')
                expect(echo._meta?.ui?.resourceUri).toBeUndefined()
            })
        })

        describe('Handler-backed tool call', () => {
            test('echo returns the echoed message', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 10,
                    method: 'tools/call',
                    params: { name: 'echo', arguments: { message: 'Hello, test!' } }
                })

                expect(result.statusCode).toBe(200)
                const body = JSON.parse(result.body)
                expect(body.result.content[0].text).toBe('Echo: Hello, test!')
            })

            test('unknown tool returns a protocol error', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 11,
                    method: 'tools/call',
                    params: { name: 'does-not-exist', arguments: {} }
                })

                expect(result.statusCode).toBe(200)
                const body = JSON.parse(result.body)
                expect(body.result.isError).toBe(true)
                expect(body.result.content[0].text).toContain('does-not-exist')
            })
        })

        describe('Handler-less config-only action', () => {
            test('empty-tool appears in tools/list with config metadata', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 20,
                    method: 'tools/list',
                    params: {}
                })

                const body = JSON.parse(result.body)
                const tool = body.result.tools.find(t => t.name === 'empty-tool')

                expect(tool).toBeDefined()
                expect(tool.description).toBe('Config-only action with no handler folder; exercises the default handler.')
                expect(tool.inputSchema.properties.query.type).toBe('string')
                expect(tool.annotations.readOnlyHint).toBe(true)
                expect(tool._meta?.ui?.resourceUri).toBeUndefined()
            })

            test('empty-tool returns empty content and structuredContent', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 21,
                    method: 'tools/call',
                    params: { name: 'empty-tool', arguments: {} }
                })

                expect(result.statusCode).toBe(200)
                const body = JSON.parse(result.body)
                expect(body.result.content[0].text).toBe('')
                expect(body.result.structuredContent).toEqual({})
            })
        })

        describe('EDS widget action', () => {
            test('eds-demo exposes widget metadata on the tool', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 30,
                    method: 'tools/list',
                    params: {}
                })

                const body = JSON.parse(result.body)
                const tool = body.result.tools.find(t => t.name === 'eds-demo')

                expect(tool).toBeDefined()
                expect(tool._meta).toBeDefined()
                expect(tool._meta.ui.resourceUri).toBe('ui://eds-demo/widget.html')
                expect(tool._meta.ui.visibility).toEqual(['model', 'app'])
                expect(tool._meta['ui/resourceUri']).toBe('ui://eds-demo/widget.html')
                expect(tool._meta['openai/outputTemplate']).toBe('ui://eds-demo/widget.html')
                expect(tool._meta['openai/resultCanProduceWidget']).toBe(true)
                expect(tool._meta['openai/toolInvocation/invoking']).toBe('Loading demo widget...')
                expect(tool._meta['openai/widgetAccessible']).toBe(true)
            })

            test('eds-demo widget resource is listed', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 31,
                    method: 'resources/list',
                    params: {}
                })

                const body = JSON.parse(result.body)
                const resource = body.result.resources.find(
                    r => r.uri === 'ui://eds-demo/widget.html'
                )
                expect(resource).toBeDefined()
                expect(resource.mimeType).toBe('text/html;profile=mcp-app')
            })

            test('eds-demo widget HTML contains aem-embed with config URLs', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 32,
                    method: 'resources/read',
                    params: { uri: 'ui://eds-demo/widget.html' }
                })

                const body = JSON.parse(result.body)
                const content = body.result.contents[0]

                expect(content.uri).toBe('ui://eds-demo/widget.html')
                expect(content.mimeType).toBe('text/html;profile=mcp-app')
                expect(content.text).toContain('<aem-embed')
                expect(content.text).toContain('url="https://example.aem.page/eds-widgets/demo"')
                expect(content.text).toContain('src="https://example.aem.page/scripts/aem-embed.js"')
            })

            test('eds-demo resource _meta carries CSP and prefersBorder from resource_meta', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 33,
                    method: 'resources/read',
                    params: { uri: 'ui://eds-demo/widget.html' }
                })

                const body = JSON.parse(result.body)
                const content = body.result.contents[0]

                expect(content._meta).toBeDefined()
                expect(content._meta.ui.csp.connectDomains).toContain('https://example.aem.page')
                expect(content._meta.ui.csp.resourceDomains).toContain('https://example.aem.page')
                expect(content._meta.ui.prefersBorder).toBe(true)
            })

            test('eds-demo returns empty content when called (no handler folder)', async () => {
                const result = await mcpPost(withMain, {
                    jsonrpc: '2.0',
                    id: 34,
                    method: 'tools/call',
                    params: { name: 'eds-demo', arguments: {} }
                })

                expect(result.statusCode).toBe(200)
                const body = JSON.parse(result.body)
                expect(body.result.content[0].text).toBe('')
                expect(body.result.structuredContent).toEqual({})
            })
        })
    })

    describe('Without actions.json (filesystem fallback)', () => {
        let withoutMain

        beforeAll(() => {
            removeActionsJson()
            withoutMain = makeMain()
        })

        test('tools/list falls back to filesystem discovery (echo only)', async () => {
            const result = await mcpPost(withoutMain, {
                jsonrpc: '2.0',
                id: 40,
                method: 'tools/list',
                params: {}
            })

            expect(result.statusCode).toBe(200)
            const body = JSON.parse(result.body)
            const names = body.result.tools.map(t => t.name)

            expect(names).toEqual(['echo'])
        })

        test('fallback tool uses folder name as description (no metadata)', async () => {
            const result = await mcpPost(withoutMain, {
                jsonrpc: '2.0',
                id: 41,
                method: 'tools/list',
                params: {}
            })

            const body = JSON.parse(result.body)
            const echo = body.result.tools.find(t => t.name === 'echo')
            expect(echo.description).toBe('echo')
            expect(echo.annotations).toBeUndefined()
            expect(echo.inputSchema?.properties || {}).toEqual({})
            expect(echo._meta?.ui?.resourceUri).toBeUndefined()
        })

        test('echo handler is still callable with default args', async () => {
            const result = await mcpPost(withoutMain, {
                jsonrpc: '2.0',
                id: 42,
                method: 'tools/call',
                params: { name: 'echo', arguments: {} }
            })

            expect(result.statusCode).toBe(200)
            const body = JSON.parse(result.body)
            expect(body.result.content[0].text).toContain('No message provided')
        })
    })

    describe('Error Handling', () => {
        test('invalid JSON body returns 500 with jsonrpc error envelope', async () => {
            const result = await main({
                __ow_method: 'post',
                __ow_body: 'not valid json',
                __ow_headers: {
                    'content-type': 'application/json',
                    accept: 'application/json;q=1.0, text/event-stream;q=0.5'
                },
                LOG_LEVEL: 'info'
            })

            expect(result.statusCode).toBe(500)
            const body = JSON.parse(result.body)
            expect(body.jsonrpc).toBe('2.0')
            expect(body.error).toBeDefined()
        })

        test('unsupported HTTP method returns 405', async () => {
            const result = await main({
                __ow_method: 'put',
                LOG_LEVEL: 'info'
            })

            expect(result.statusCode).toBe(405)
        })
    })
})

/**
 * Developer integration test example.
 *
 * Copy this pattern into your own test file to test your action handlers through
 * the full MCP request stack (createMain → loadActionsFromFs → McpServer → SDK).
 *
 * Run with: npm test
 */
describe('Developer integration test example', () => {
    let devMain
    const ACTIONS_DIR = path.join(__dirname, '..', 'actions')

    beforeAll(() => {
        fs.copyFileSync(path.resolve(__dirname, 'fixtures', 'actions.json'), path.resolve(__dirname, '..', 'actions.json'))

        // Point createMain at the real actions/ directory.
        // Swap actionsDir to a temp directory when testing isolated scenarios.
        ;({ main: devMain } = createMain({ actionsDir: ACTIONS_DIR, serverName: 'llm-apps-poc' }))
    })

    afterAll(() => {
        try { fs.unlinkSync(path.resolve(__dirname, '..', 'actions.json')) } catch (e) { /* ignore */ }
    })

    async function call (toolName, args = {}) {
        const res = await devMain({
            __ow_method: 'post',
            __ow_body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } }),
            __ow_headers: { 'content-type': 'application/json', accept: 'application/json;q=1.0, text/event-stream;q=0.5' },
            LOG_LEVEL: 'info'
        })
        return JSON.parse(res.body)
    }

    test('echo action round-trips message', async () => {
        const body = await call('echo', { message: 'integration test' })
        expect(body.result.content[0].text).toBe('Echo: integration test')
    })

    test('echo action returns text content', async () => {
        const body = await call('echo', { message: 'world' })
        expect(body.result.content[0].type).toBe('text')
        expect(body.result.content[0].text).toBe('Echo: world')
    })
})
