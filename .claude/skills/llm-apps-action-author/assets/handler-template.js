/**
 * <ACTION_NAME> action handler.
 *
 * Tool-only (no widget). Metadata (title, description, inputSchema,
 * annotations) is authored in the llm-apps UI and materialized into
 * actions.json by the deploy pipeline.
 */

module.exports = async (args) => {
    // TODO: implement the tool logic. `args` matches the input schema
    //       you configured in the llm-apps UI.

    const summary = `TODO: return a short text summary for the LLM. Received: ${JSON.stringify(args)}`

    return {
        content: [
            { type: 'text', text: summary }
        ]
    }
}
