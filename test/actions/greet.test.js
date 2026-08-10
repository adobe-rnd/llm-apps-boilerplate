const handler = require('../../actions/greet/index.js')

describe('greet handler', () => {
    test('falls back to the default prefix with no extra', async () => {
        const out = await handler({ name: 'Ada' })

        expect(out.content[0].text).toBe('Hello, Ada!')
    })

    test('falls back to the default prefix with no variables configured', async () => {
        const out = await handler({ name: 'Ada' }, {})

        expect(out.content[0].text).toBe('Hello, Ada!')
    })

    test('uses the declared GREETING_PREFIX variable', async () => {
        const out = await handler({ name: 'Ada' }, { variables: { GREETING_PREFIX: 'Howdy' } })

        expect(out.content[0].text).toBe('Howdy, Ada!')
    })

    test('ignores unrelated keys in extra.variables', async () => {
        const out = await handler({ name: 'Ada' }, { variables: { LLMA_ANALYTICS_KEY: 'leak-me-not' } })

        expect(out.content[0].text).toBe('Hello, Ada!')
        expect(out.content[0].text).not.toContain('leak-me-not')
    })

    test('return value matches MCP content block shape', async () => {
        const out = await handler({ name: 'Ada' }, { variables: { GREETING_PREFIX: 'Howdy' } })

        expect(out).toHaveProperty('content')
        expect(Array.isArray(out.content)).toBe(true)
        expect(out.content[0]).toMatchObject({ type: 'text', text: expect.any(String) })
    })
})
