/**
 * Unit tests for the <ACTION_NAME> action handler.
 *
 * Handler tests live under test/actions/, NOT co-located with the handler,
 * so webpack doesn't bundle them into dist/index.js at deploy time.
 *
 * Run with:
 *   npm test                                 # all test files
 *   npx jest test/actions/<ACTION_NAME>      # only this file
 */

const handler = require('../../actions/<ACTION_NAME>/index.js')

describe('<ACTION_NAME> handler', () => {
    test('returns the MCP content-block shape', async () => {
        // TODO: replace with realistic args matching your inputSchema.
        const out = await handler({})

        expect(out).toHaveProperty('content')
        expect(Array.isArray(out.content)).toBe(true)
        expect(out.content[0]).toMatchObject({
            type: 'text',
            text: expect.any(String)
        })
    })

    // TODO: add at least one test per meaningful branch of your handler,
    //       e.g. happy path, missing-required-arg, upstream API failure.
    //
    // test('handles missing city arg', async () => {
    //     const out = await handler({})
    //     expect(out.content[0].text).toMatch(/required/i)
    // })
    //
    // If your handler returns structuredContent (widget case):
    //
    // test('structuredContent is a plain object, not an array', async () => {
    //     const out = await handler({ city: 'London' })
    //     expect(typeof out.structuredContent).toBe('object')
    //     expect(Array.isArray(out.structuredContent)).toBe(false)
    // })
})
