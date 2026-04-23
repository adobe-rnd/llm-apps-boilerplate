/**
 * Jest transform for .html files.
 * Mirrors webpack's asset/source behavior: imports HTML as a raw string.
 */
module.exports = {
    process (sourceText) {
        return {
            code: `module.exports = ${JSON.stringify(sourceText)};`
        }
    }
}
