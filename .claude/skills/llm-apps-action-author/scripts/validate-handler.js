#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * validate-handler.js -- sanity-check an llm-apps action handler.
 *
 * Usage:
 *   node .claude/skills/llm-apps-action-author/scripts/validate-handler.js actions/<name>/index.js
 *
 * Checks:
 *   1. File exists.
 *   2. module.exports (or module.exports.default) is a function.
 *   3. The function is async / returns a Promise.
 *   4. A trivial invocation resolves to { content: Array, structuredContent?: object }.
 *   5. structuredContent, if present, is a plain object (not a bare array).
 *
 * Zero runtime dependencies.
 */

const fs = require('fs')
const path = require('path')

function fail (msg) {
    console.error(`FAIL: ${msg}`)
    process.exit(1)
}

function pass (msg) {
    console.log(`PASS: ${msg}`)
}

async function main () {
    const [, , rawArg] = process.argv
    if (!rawArg) {
        console.error('usage: validate-handler.js actions/<name>/index.js')
        process.exit(1)
    }

    const target = path.resolve(process.cwd(), rawArg)
    if (!fs.existsSync(target)) {
        fail(`file not found: ${target}`)
    }
    pass(`file exists: ${rawArg}`)

    let mod
    try {
        mod = require(target)
    } catch (err) {
        fail(`require() threw: ${err.message}`)
    }

    const candidate = typeof mod === 'function'
        ? mod
        : (mod && typeof mod.default === 'function' ? mod.default : null)

    if (!candidate) {
        fail('module.exports (or module.exports.default) is not a function. ' +
             'The loader only accepts `module.exports = async (args) => ({...})`.')
    }
    pass('export shape is a function')

    let result
    try {
        result = candidate({})
    } catch (err) {
        fail(`handler threw when invoked: ${err.message}`)
    }

    if (!result || typeof result.then !== 'function') {
        fail('handler did not return a Promise. Make it `async`.')
    }
    pass('handler returns a Promise (async)')

    let value
    try {
        value = await result
    } catch (err) {
        fail(`handler rejected with: ${err.message}`)
    }

    if (!value || typeof value !== 'object') {
        fail('handler resolved to a non-object value. Expected { content, structuredContent? }.')
    }

    if (!Array.isArray(value.content)) {
        fail('handler output is missing a `content` array. ' +
             'Expected: content: [{ type: "text", text: "..." }]')
    }
    pass('output has content: [...]')

    const invalidPart = value.content.find(
        (p) => !p || typeof p !== 'object' || typeof p.type !== 'string'
    )
    if (invalidPart) {
        fail(`content[] has an invalid part (missing string "type"): ${JSON.stringify(invalidPart)}`)
    }
    pass('content[] parts all have a `type`')

    if ('structuredContent' in value) {
        const sc = value.structuredContent
        if (sc === null || typeof sc !== 'object' || Array.isArray(sc)) {
            fail('structuredContent must be a plain object. ' +
                 'Wrap bare arrays: { items: [...] } instead of [...].')
        }
        pass('structuredContent is a plain object')
    } else {
        console.log('note: no structuredContent (fine for tool-only actions).')
    }

    console.log('\nhandler looks good.')
}

main().catch((err) => {
    console.error(`unexpected validator error: ${err.stack || err.message || err}`)
    process.exit(1)
})
