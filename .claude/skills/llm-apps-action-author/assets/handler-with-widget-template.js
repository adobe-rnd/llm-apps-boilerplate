/**
 * <ACTION_NAME> action handler with widget.
 *
 * Returns both:
 *   - content: text for the LLM / fallback hosts
 *   - structuredContent: plain object consumed by widget.html via
 *                        window.openai.toolOutput
 *
 * Metadata lives in the llm-apps UI. Widget HTML lives next to this file.
 */

module.exports = async (args) => {
    // TODO: implement the tool logic.

    const summary = `TODO: short text for the LLM. Received: ${JSON.stringify(args)}`

    // IMPORTANT: structuredContent must be a plain object, NOT a bare array.
    // Wrap arrays: { items: [...] } instead of [...].
    const data = {
        echoedArgs: args,
        generatedAt: new Date().toISOString()
        // TODO: add the fields your widget needs.
    }

    return {
        content: [
            { type: 'text', text: summary }
        ],
        structuredContent: data
    }
}
