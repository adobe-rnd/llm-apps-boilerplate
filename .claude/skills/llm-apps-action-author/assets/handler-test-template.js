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
// Example arguments, also used by check-action.js. Keep them realistic.
const example = require('../fixtures/<ACTION_NAME>/example.json')

describe('<ACTION_NAME> handler', () => {
    test('returns the MCP content-block shape', async () => {
        const out = await handler(example.arguments)

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
    // If your handler returns structuredContent (widget case), pin the exact
    // shape the EDS block renders, and keep it identical on error/empty branches:
    //
    // test('structuredContent matches the widget contract', async () => {
    //     const out = await handler(example.arguments)
    //     expect(out.structuredContent).toEqual({ items: expect.any(Array), total: expect.any(Number) })
    // })
})
