const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const handler = require('../../actions/open_csv/index.js')

const file = { name: 'report.csv', resourceUri: 'file://opened/report.csv' }
const widget = fs.readFileSync(path.join(__dirname, '../../actions/open_csv/widget.html'), 'utf8')
const script = widget.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace(/import .*?;\s*/, '')

const resource = (metadata = { writable: true, etag: 'v1' }) => ({
    contents: [
        { uri: 'file://other.csv', text: 'not the opened file' },
        { uri: file.resourceUri, text: 'name,total\nAda,42', openaiMetadata: metadata }
    ]
})

async function openWidget(overrides = {}) {
    const elements = Object.fromEntries(['name', 'editor', 'status', 'save', 'reload'].map((id) => [
        id,
        {
            textContent: '',
            value: '',
            disabled: id === 'save' || id === 'reload',
            readOnly: id === 'editor',
            listeners: {},
            addEventListener(event, callback) { this.listeners[event] = callback }
        }
    ]))
    const app = {
        toolResult: Promise.resolve({ structuredContent: { file } }),
        readResource: jest.fn().mockResolvedValue(resource()),
        writeResource: jest.fn().mockResolvedValue({ outcome: 'saved', etag: 'v2' }),
        ...overrides
    }
    await vm.runInNewContext(`(async () => { ${script} })()`, {
        document: { getElementById: (id) => elements[id] },
        createApp: jest.fn().mockResolvedValue(app)
    })
    return { app, elements }
}

describe('open_csv handler', () => {
    test('returns only file input, never client-supplied path metadata', async () => {
        const out = await handler({ file }, { _meta: { 'openai/resource': { path: '/private/report.csv' } } })

        expect(out.structuredContent).toEqual({ file })
        expect(JSON.stringify(out)).not.toContain('/private/report.csv')
    })

    test.each([undefined, {}, { file: { name: 'report.csv' } }])('reports missing or malformed file input: %p', async (args) => {
        expect(await handler(args)).toMatchObject({
            isError: true,
            content: [{ type: 'text', text: 'No file was provided to open.' }]
        })
    })
})

describe('open_csv widget', () => {
    test('loads the initial toolResult and carries ETags through consecutive saves', async () => {
        const { app, elements } = await openWidget()

        expect(app.readResource).toHaveBeenCalledWith(file.resourceUri, { representation: 'text' })
        expect(elements.editor.value).toBe('name,total\nAda,42')
        elements.editor.value = 'name,total\nAda,43'
        await elements.save.listeners.click()
        expect(app.writeResource).toHaveBeenLastCalledWith(file.resourceUri, {
            text: 'name,total\nAda,43', ifMatch: 'v1'
        })
        expect(elements.status.textContent).toBe('Saved.')
        await elements.save.listeners.click()
        expect(app.writeResource).toHaveBeenLastCalledWith(file.resourceUri, {
            text: 'name,total\nAda,43', ifMatch: 'v2'
        })
    })

    test.each([
        [{ writable: false, etag: 'v1' }, 'read-only'],
        [{ writable: true }, 'ETag'],
        [{ writable: true, etag: '' }, 'ETag'],
        [undefined, 'read-only']
    ])('prevents writes without writable metadata and a non-empty ETag: %p', async (metadata, message) => {
        const result = resource()
        result.contents[1].openaiMetadata = metadata
        const { app, elements } = await openWidget({
            readResource: jest.fn().mockResolvedValue(result)
        })

        expect(elements.save.disabled).toBe(true)
        expect(elements.editor.readOnly).toBe(true)
        expect(elements.status.textContent).toContain(message)
        await elements.save.listeners.click()
        expect(app.writeResource).not.toHaveBeenCalled()
    })

    test('blocks repeated saves after conflict until an explicit reload supplies a fresh ETag', async () => {
        const { app, elements } = await openWidget({
            writeResource: jest.fn().mockResolvedValue({ outcome: 'conflict', etag: 'v2' })
        })
        elements.editor.value = 'unsaved edits'
        await elements.save.listeners.click()

        expect(elements.editor.value).toBe('unsaved edits')
        expect(elements.save.disabled).toBe(true)
        expect(elements.status.textContent).toContain('changed elsewhere')
        await elements.save.listeners.click()
        expect(app.writeResource).toHaveBeenCalledTimes(1)

        app.readResource.mockResolvedValue(resource({ writable: true, etag: 'v3' }))
        await elements.reload.listeners.click()
        expect(elements.save.disabled).toBe(false)
        app.writeResource.mockResolvedValue({ outcome: 'saved', etag: 'v4' })
        await elements.save.listeners.click()
        expect(app.writeResource).toHaveBeenLastCalledWith(file.resourceUri, {
            text: 'name,total\nAda,42', ifMatch: 'v3'
        })
    })

    test.each([
        [jest.fn().mockResolvedValue({ outcome: 'too-large', maxBytes: 100 }), 'Too large (max 100 bytes).'],
        [jest.fn().mockRejectedValue(new Error('Host denied access')), 'Could not save file: Host denied access']
    ])('surfaces write failures without claiming success', async (writeResource, message) => {
        const { elements } = await openWidget({ writeResource })
        await elements.save.listeners.click()

        expect(elements.status.textContent).toBe(message)
        expect(elements.save.disabled).toBe(false)
        expect(elements.reload.disabled).toBe(false)
    })

    test.each([
        jest.fn().mockRejectedValue(new Error('Read failed')),
        jest.fn().mockResolvedValue({ contents: [{ uri: 'file://other.csv', text: 'wrong file' }] })
    ])('keeps saving disabled when the file cannot be read', async (readResource) => {
        const { elements } = await openWidget({ readResource })

        expect(elements.save.disabled).toBe(true)
        expect(elements.status.textContent).toContain('Could not load file:')
        expect(elements.reload.disabled).toBe(false)
    })

    test('surfaces tool errors without reading a resource', async () => {
        const { app, elements } = await openWidget({
            toolResult: Promise.resolve({ isError: true, content: [{ type: 'text', text: 'No file available' }] })
        })

        expect(app.readResource).not.toHaveBeenCalled()
        expect(elements.status.textContent).toBe('Could not open file: No file available')
        expect(elements.save.disabled).toBe(true)
    })
})
