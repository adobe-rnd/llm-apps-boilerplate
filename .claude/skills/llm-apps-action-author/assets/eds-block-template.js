/*
 * <ACTION_NAME> — LLM Apps widget block.
 *
 * Rendered inside the LLM host (ChatGPT, Claude, ...) by scripts/aem-embed.js,
 * which passes an MCP bridge as the second argument of decorate().
 * The block reads the handler's structuredContent from bridge.toolResult.
 *
 * Preview: /tools/widget-preview.html?block=<ACTION_NAME> renders PREVIEW_RESULT
 * (the preview bridge sets hostContext.preview === true).
 */

// Sample structuredContent, used outside a live host. Keep it shaped like the
// handler's real structuredContent.
const PREVIEW_RESULT = {
  title: '<ACTION_TITLE>',
  message: 'This is a placeholder widget. Replace it with the real UI.',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function render(block, result) {
  const card = el('div', '<ACTION_NAME>-card');
  card.append(
    el('h2', '<ACTION_NAME>-title', result?.title || '<ACTION_TITLE>'),
    el('p', '<ACTION_NAME>-message', result?.message || ''),
  );
  block.replaceChildren(card);
}

export default async function decorate(block, bridge) {
  const connected = bridge?.isConnected === true;
  const live = connected && bridge.hostContext?.preview !== true;

  if (connected) {
    const applyTheme = (context) => {
      const theme = context?.theme;
      if (theme === 'light' || theme === 'dark') block.dataset.theme = theme;
    };
    applyTheme(bridge.hostContext);
    bridge.onContextChange(applyTheme);
  }

  let result = PREVIEW_RESULT;
  if (live) {
    try {
      result = (await bridge.toolResult)?.structuredContent || {};
    } catch (e) {
      result = {};
    }
  }
  render(block, result);

  if (connected) bridge.autoResize(block);
}
