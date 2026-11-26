/**
 * Lets plain Node load handlers that require '@adobe/llm-apps-runtime'.
 *
 * @adobe/llm-apps-runtime <= 1.8.0 requires '@modelcontextprotocol/sdk/server/mcp' (no '.js').
 * Webpack (deploy, dev:local) and Jest resolve it; plain Node does not, so the skill's
 * scripts would crash on any handler using runtime helpers (getFileInput, getVariable, ...).
 * Retry unresolved '@modelcontextprotocol/sdk/*' specifiers with '.js'. Scoped to that package.
 */

const Module = require('module')

if (typeof Module.registerHooks === 'function') {
    Module.registerHooks({
        resolve (specifier, context, nextResolve) {
            try {
                return nextResolve(specifier, context)
            } catch (err) {
                if (specifier.startsWith('@modelcontextprotocol/sdk/') && !specifier.endsWith('.js')) {
                    return nextResolve(`${specifier}.js`, context)
                }
                throw err
            }
        }
    })
}
