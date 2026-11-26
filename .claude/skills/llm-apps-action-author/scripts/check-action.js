#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * check-action.js -- end-to-end correctness gate for one llm-apps action.
 *
 * Usage (from the handler repo root):
 *   node .claude/skills/llm-apps-action-author/scripts/check-action.js <id> [--eds <eds-repo>] [--args '<json>']
 *
 * Handler repo checks:
 *   - handler passes validate-handler.js (export shape, return contract)
 *   - test/actions/<id>.test.js exists
 *   - handler runs with the example arguments (--args, else test/fixtures/<id>/example.json
 *     "arguments", else {}) and returns content + structuredContent
 *   - local actions.json (if present) declares every example argument, else args are stripped
 * EDS block checks (when the EDS repo is found; auto-detects ../<handler-repo>-eds):
 *   - blocks/<id>/<id>.js and .css exist; JS parses as an ES module
 *   - `export default [async] function decorate(block, bridge)` (two parameters)
 *   - reads the tool result (bridge.toolResult / bridge.onToolResult) and guards a missing bridge
 *   - no innerHTML / insertAdjacentHTML built from template literals (XSS)
 *   - every CSS selector is scoped to .<id>
 *   - PREVIEW_RESULT (and blocks/<id>/<id>.json if present) has the same shape as the
 *     handler's structuredContent -> the widget reads exactly what the handler returns
 *   - no actions/<id>/widget.html (it would override the EDS widget)
 *
 * Exits 1 if any check fails. Warnings don't fail the run. Zero dependencies.
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { spawnSync } = require('child_process')

require('./lib/runtime-resolve')

const failures = []
const warnings = []
const fail = (msg) => { failures.push(msg); console.log(`FAIL: ${msg}`) }
const warn = (msg) => { warnings.push(msg); console.log(`WARN: ${msg}`) }
const pass = (msg) => console.log(`PASS: ${msg}`)

function parseArgs (argv) {
    const opts = { id: null, eds: null, args: null }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--eds') opts.eds = argv[++i]
        else if (a === '--args') opts.args = argv[++i]
        else if (a === '-h' || a === '--help') opts.help = true
        else if (!opts.id) opts.id = a
        else throw new Error(`unexpected argument: ${a}`)
    }
    return opts
}

// Structural type of a value: objects by keys, arrays by their first element.
function shapeOf (value) {
    if (value === null || value === undefined) return 'null'
    if (Array.isArray(value)) return { array: value.length ? shapeOf(value[0]) : 'unknown' }
    if (typeof value === 'object') {
        const out = {}
        for (const k of Object.keys(value).sort()) out[k] = shapeOf(value[k])
        return { object: out }
    }
    return typeof value
}

// Differences between two shapes. 'null'/'unknown' are compatible with anything.
function shapeDiff (a, b, at = '') {
    if (a === 'null' || b === 'null' || a === 'unknown' || b === 'unknown') return []
    if (typeof a === 'string' || typeof b === 'string') {
        return a === b ? [] : [`${at || '(root)'}: ${describe(a)} vs ${describe(b)}`]
    }
    if (a.array && b.array) return shapeDiff(a.array, b.array, `${at}[]`)
    if (a.object && b.object) {
        const diffs = []
        for (const k of new Set([...Object.keys(a.object), ...Object.keys(b.object)])) {
            const p = at ? `${at}.${k}` : k
            if (!(k in a.object)) diffs.push(`${p}: missing in the first`)
            else if (!(k in b.object)) diffs.push(`${p}: missing in the second`)
            else diffs.push(...shapeDiff(a.object[k], b.object[k], p))
        }
        return diffs
    }
    return [`${at || '(root)'}: ${describe(a)} vs ${describe(b)}`]
}

function describe (shape) {
    if (typeof shape === 'string') return shape
    return shape.array ? 'array' : 'object'
}

// Extracts `const NAME = <literal>` from source by bracket matching and evaluates the literal.
function extractConst (src, names) {
    for (const name of names) {
        const m = new RegExp(`const\\s+${name}\\s*=\\s*`).exec(src)
        if (!m) continue
        const start = m.index + m[0].length
        const open = src[start]
        if (open !== '{' && open !== '[') continue
        const close = open === '{' ? '}' : ']'
        let depth = 0
        let quote = null
        for (let i = start; i < src.length; i++) {
            const c = src[i]
            if (quote) {
                if (c === '\\') i++
                else if (c === quote) quote = null
                continue
            }
            if (c === '"' || c === "'" || c === '`') quote = c
            else if (c === open) depth++
            else if (c === close && --depth === 0) {
                return { name, value: vm.runInNewContext(`(${src.slice(start, i + 1)})`, {}, { timeout: 1000 }) }
            }
        }
    }
    return null
}

// Top-level rule selectors of a stylesheet, skipping @-rule preludes and keyframe steps.
function cssSelectors (css) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const selectors = []
    const stack = []
    let buf = ''
    for (const c of text) {
        if (c === '{') {
            const prelude = buf.trim()
            buf = ''
            const parent = stack[stack.length - 1]
            if (prelude.startsWith('@')) stack.push(/^@(-\w+-)?keyframes/.test(prelude) ? 'keyframes' : 'at')
            else if (parent === 'keyframes' || parent === 'rule') stack.push('inner')
            else { selectors.push(...prelude.split(',').map((s) => s.trim()).filter(Boolean)); stack.push('rule') }
        } else if (c === '}') {
            stack.pop()
            buf = ''
        } else if (c === ';' && stack[stack.length - 1] !== 'rule') {
            buf = ''
        } else {
            buf += c
        }
    }
    return selectors
}

function findEdsRepo (opt, repoRoot) {
    if (opt) return path.resolve(opt)
    const sibling = path.resolve(repoRoot, '..', `${path.basename(repoRoot)}-eds`)
    return fs.existsSync(path.join(sibling, 'scripts', 'aem-embed.js')) ? sibling : null
}

async function checkHandler (id, repoRoot, opts) {
    const handlerPath = path.join(repoRoot, 'actions', id, 'index.js')
    if (!fs.existsSync(handlerPath)) {
        fail(`actions/${id}/index.js not found (folder name must equal the Code identifier)`)
        return null
    }

    const validator = spawnSync(process.execPath, [path.join(__dirname, 'validate-handler.js'), handlerPath], { encoding: 'utf8' })
    if (validator.status === 0) pass('validate-handler.js')
    else fail(`validate-handler.js:\n${(validator.stdout + validator.stderr).trim()}`)

    if (fs.existsSync(path.join(repoRoot, 'test', 'actions', `${id}.test.js`))) pass(`test/actions/${id}.test.js exists`)
    else fail(`test/actions/${id}.test.js is missing`)

    let args = {}
    let argsSource = '{}'
    const examplePath = path.join(repoRoot, 'test', 'fixtures', id, 'example.json')
    if (opts.args) {
        args = JSON.parse(opts.args)
        argsSource = '--args'
    } else if (fs.existsSync(examplePath)) {
        args = JSON.parse(fs.readFileSync(examplePath, 'utf8')).arguments || {}
        argsSource = `test/fixtures/${id}/example.json`
    }

    const actionsJsonPath = path.join(repoRoot, 'actions.json')
    if (fs.existsSync(actionsJsonPath)) {
        const entry = (JSON.parse(fs.readFileSync(actionsJsonPath, 'utf8')).actions || []).find((a) => a.name === id)
        if (!entry) {
            warn(`actions.json has no "${id}" entry: re-download it from the UI or re-run scaffold-action.sh`)
        } else {
            const declared = Object.keys(entry.inputSchema?.properties || {})
            const undeclared = Object.keys(args).filter((k) => !declared.includes(k))
            if (undeclared.length) fail(`actions.json inputSchema for "${id}" lacks ${undeclared.join(', ')}: the runtime strips these args`)
            else pass('actions.json inputSchema declares every example argument')
        }
    }

    let out
    try {
        const mod = require(handlerPath)
        const handler = typeof mod === 'function' ? mod : mod.default
        out = await handler(args, {})
    } catch (err) {
        fail(`handler threw with args from ${argsSource}: ${err.message}. Pass realistic args with --args '<json>' (mock network in tests).`)
        return null
    }
    if (!out || !Array.isArray(out.content) || !out.content.some((p) => p && p.type === 'text' && typeof p.text === 'string' && p.text.trim())) {
        fail('handler output needs a non-empty text item in content')
    } else {
        pass(`handler returns text content (args from ${argsSource})`)
    }
    return out
}

function checkBlock (id, edsRepo, repoRoot, handlerOut) {
    const blockDir = path.join(edsRepo, 'blocks', id)
    const jsPath = path.join(blockDir, `${id}.js`)
    const cssPath = path.join(blockDir, `${id}.css`)
    if (!fs.existsSync(jsPath)) {
        fail(`blocks/${id}/${id}.js not found in ${edsRepo} (block name must equal the Code identifier)`)
        return
    }
    pass(`blocks/${id}/${id}.js exists`)

    if (fs.existsSync(path.join(repoRoot, 'actions', id, 'widget.html'))) {
        fail(`actions/${id}/widget.html exists and overrides the EDS widget: delete it`)
    }

    const src = fs.readFileSync(jsPath, 'utf8')
    const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' })
    if (syntax.status === 0) pass('block JS parses as an ES module')
    else fail(`block JS has a syntax error:\n${syntax.stderr.trim().split('\n').slice(0, 5).join('\n')}`)

    const decl = /export\s+default\s+(async\s+)?function\s*\w*\s*\(([^)]*)\)/.exec(src)
    if (!decl) fail('block must `export default async function decorate(block, bridge)`')
    else {
        const params = decl[2].split(',').map((p) => p.trim()).filter(Boolean)
        if (params.length !== 2) fail(`decorate() must take (block, bridge); found (${params.join(', ')})`)
        else {
            pass(`decorate(${params.join(', ')})`)
            const bridge = params[1]
            if (!new RegExp(`${bridge}\\??\\.(toolResult|onToolResult)\\b`).test(src)) {
                warn('block never reads bridge.toolResult / bridge.onToolResult: it ignores the handler output')
            } else {
                pass('block reads the tool result')
            }
            if (!new RegExp(`${bridge}\\?\\.|!\\s*${bridge}\\b|${bridge}\\s*&&|isConnected`).test(src)) {
                fail(`block must handle a missing bridge (plain EDS page view calls decorate(block) only): use ${bridge}?.`)
            }
        }
    }

    if (/\.innerHTML\s*\+?=\s*`[^`]*\$\{|insertAdjacentHTML\([^)]*`[^`]*\$\{/.test(src)) {
        fail('block builds HTML from template literals (XSS risk): use createElement + textContent')
    } else if (/\.innerHTML\s*\+?=/.test(src)) {
        warn('block assigns innerHTML: make sure no tool data reaches it')
    }

    if (!fs.existsSync(cssPath)) fail(`blocks/${id}/${id}.css not found`)
    else {
        const unscoped = cssSelectors(fs.readFileSync(cssPath, 'utf8')).filter((s) => !s.startsWith(`.${id}`))
        if (unscoped.length) fail(`CSS selectors not scoped to .${id}: ${unscoped.slice(0, 5).join(' | ')}`)
        else pass(`CSS selectors scoped to .${id}`)
    }

    const sc = handlerOut && handlerOut.structuredContent
    if (sc === undefined) {
        fail('handler returns no structuredContent, but the action has a widget block')
        return
    }

    const preview = extractConst(src, ['PREVIEW_RESULT', 'SAMPLE_DATA'])
    const samples = []
    if (preview) samples.push([preview.name, preview.value])
    else warn('block has no PREVIEW_RESULT: the preview harness and EDS page show nothing realistic')
    const jsonPath = path.join(blockDir, `${id}.json`)
    if (fs.existsSync(jsonPath)) samples.push([`blocks/${id}/${id}.json`, JSON.parse(fs.readFileSync(jsonPath, 'utf8'))])

    for (const [label, value] of samples) {
        const diffs = shapeDiff(shapeOf(value), shapeOf(sc))
        if (diffs.length) {
            fail(`${label} shape differs from handler structuredContent (first = ${label}, second = handler):\n  ${diffs.slice(0, 10).join('\n  ')}`)
        } else {
            pass(`${label} has the same shape as handler structuredContent`)
        }
    }
}

async function main () {
    const opts = parseArgs(process.argv.slice(2))
    if (opts.help || !opts.id) {
        console.log("usage: check-action.js <id> [--eds <eds-repo>] [--args '<json>']")
        process.exit(opts.id || opts.help ? 0 : 1)
    }
    const repoRoot = process.cwd()
    if (!fs.existsSync(path.join(repoRoot, 'actions'))) {
        console.error('run from the handler repo root (actions/ not found)')
        process.exit(1)
    }

    console.log(`== handler: actions/${opts.id}`)
    const out = await checkHandler(opts.id, repoRoot, opts)

    const edsRepo = findEdsRepo(opts.eds, repoRoot)
    const hasBlock = edsRepo && fs.existsSync(path.join(edsRepo, 'blocks', opts.id))
    if (edsRepo && hasBlock) {
        console.log(`\n== EDS block: ${path.join(edsRepo, 'blocks', opts.id)}`)
        checkBlock(opts.id, edsRepo, repoRoot, out)
    } else if (opts.eds) {
        console.log(`\n== EDS block: ${path.join(edsRepo, 'blocks', opts.id)}`)
        fail(`blocks/${opts.id}/ not found in ${edsRepo}`)
    } else {
        console.log('\n(no EDS block checked: pass --eds <eds-repo> for widget actions)')
    }

    console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s)`)
    process.exit(failures.length ? 1 : 0)
}

main().catch((err) => {
    console.error(`check-action error: ${err.stack || err.message}`)
    process.exit(1)
})
