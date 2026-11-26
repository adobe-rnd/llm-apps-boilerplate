/**
 * <ACTION_NAME> action handler with widget.
 *
 * Returns both:
 *   - content: text for the LLM / fallback hosts
 *   - structuredContent: plain object rendered by the widget (EDS block via
 *                        bridge.toolResult, or widget.html via app.toolResult)
 *
 * Metadata lives in the llm-apps UI. Widget HTML lives next to this file.
 */

module.exports = async (args = {}) => {
    // TODO: implement the tool logic.

    const summary = `TODO: short text for the LLM. Received: ${JSON.stringify(args)}`

    // IMPORTANT: structuredContent must be a plain object, NOT a bare array.
    // Wrap arrays: { items: [...] } instead of [...].
    // This is the widget contract: the EDS block's PREVIEW_RESULT (assets/eds-block-template.js)
    // starts with the same { title, message } shape. Change both together; check-action.js
    // fails when their shapes differ.
    const data = {
        title: '<ACTION_NAME>',
        message: `TODO: replace with the data your widget renders. Received: ${JSON.stringify(args)}`
    }

    return {
        content: [
            { type: 'text', text: summary }
        ],
        structuredContent: data
    }
}
