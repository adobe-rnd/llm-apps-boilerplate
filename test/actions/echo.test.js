/**
 * Unit tests for the echo action handler.
 *
 * This file is the canonical example of how to test an action handler in
 * isolation — no MCP server, no network, no I/O Runtime. Just call the
 * exported async function directly and assert on its return value.
 *
 * Copy this pattern for every action you add:
 *
 *   cp test/actions/echo.test.js test/actions/my-action.test.js
 *
 * Then update the require path and write tests that match your handler's behavior.
 *
 * Run with:
 *   npm test                        # run all test files
 *   npx jest test/actions/echo      # run only this file
 */

const handler = require('../../actions/echo/index.js')

describe('echo handler', () => {
    test('echoes the message', async () => {
        const out = await handler({ message: 'hello' })

        expect(out.content[0].type).toBe('text')
        expect(out.content[0].text).toBe('Echo: hello')
    })

    test('uses default message when no argument is provided', async () => {
        const out = await handler({})

        expect(out.content[0].type).toBe('text')
        expect(out.content[0].text).toBe('Echo: No message provided')
    })

    test('content is always an array of typed parts', async () => {
        const out = await handler({ message: 'x' })

        expect(Array.isArray(out.content)).toBe(true)
        for (const part of out.content) {
            expect(typeof part.type).toBe('string')
        }
    })

    test('return value matches MCP content block shape', async () => {
        const out = await handler({ message: 'test' })

        expect(out).toHaveProperty('content')
        expect(out.content).toHaveLength(1)
        expect(out.content[0]).toMatchObject({ type: 'text', text: expect.any(String) })
    })
})
