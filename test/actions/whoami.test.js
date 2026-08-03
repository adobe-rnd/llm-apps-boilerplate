/**
 * Unit tests for the whoami action handler.
 *
 * Reference example for testing an auth-aware action: no MCP server, no auth
 * gate, no real IdP -- just call the handler with a hand-built `extra.authInfo`
 * shaped like what the runtime would populate for a real verified token.
 *
 * Run with:
 *   npm test                          # all test files
 *   npx jest test/actions/whoami      # only this file
 */

const handler = require('../../actions/whoami/index.js')

describe('whoami handler', () => {
    test('returns "unknown" when there is no authInfo at all', async () => {
        const out = await handler({}, {})

        expect(out.content[0].type).toBe('text')
        expect(out.content[0].text).toBe('unknown')
    })

    test('returns "unknown" when extra itself is missing (no crash)', async () => {
        const out = await handler({})

        expect(out.content[0].text).toBe('unknown')
    })

    test('returns "unknown" when authInfo has no sub claim', async () => {
        const out = await handler({}, { authInfo: { token: 't', clientId: 'c', scopes: [], extra: {} } })

        expect(out.content[0].text).toBe('unknown')
    })

    test('surfaces the sub claim from a verified token', async () => {
        const authInfo = {
            token: 'test-token',
            clientId: 'my-client',
            scopes: ['orders:read'],
            expiresAt: 1893456000,
            resource: 'https://ns.adobeio-static.net/api/v1/web/pkg/mcp',
            extra: { sub: 'user-123' }
        }

        const out = await handler({}, { authInfo })

        expect(out.content[0].text).toBe('user:user-123')
    })

    test('never includes the raw token in the response', async () => {
        const authInfo = { token: 'super-secret-token-value', clientId: 'c', scopes: [], extra: { sub: 'user-123' } }

        const out = await handler({}, { authInfo })

        expect(out.content[0].text).not.toContain('super-secret-token-value')
    })

    test('return value matches MCP content block shape', async () => {
        const authInfo = { token: 't', clientId: 'c', scopes: [], extra: { sub: 'user-123' } }
        const out = await handler({}, { authInfo })

        expect(out).toHaveProperty('content')
        expect(Array.isArray(out.content)).toBe(true)
        expect(out.content[0]).toMatchObject({ type: 'text', text: expect.any(String) })
    })
})
