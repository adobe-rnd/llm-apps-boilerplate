#!/usr/bin/env bash
#
# scaffold-eds-block.sh -- create the EDS widget block for an llm-apps action.
#
# Usage (from the handler repo root):
#   bash .claude/skills/llm-apps-action-author/scripts/scaffold-eds-block.sh <action-name> <eds-repo-path>
#
# Creates, in the EDS repo:
#   blocks/<action-name>/<action-name>.js    (from assets/eds-block-template.js)
#   blocks/<action-name>/<action-name>.css   (from assets/eds-block-template.css)
#
# The block name MUST equal the action's Code identifier: the EDS page invokes the
# block by that name, and aem-embed.js loads /blocks/<name>/<name>.{js,css}.
#
# Zero dependencies beyond bash + coreutils.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets"

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <action-name> <eds-repo-path>" >&2
    exit 1
fi

ACTION_NAME="$1"
EDS_REPO="$2"

if ! [[ "$ACTION_NAME" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]]; then
    echo "error: action name must be kebab-case (the action's Code identifier). got: '$ACTION_NAME'" >&2
    exit 1
fi

if [ ! -d "$EDS_REPO/blocks" ] || [ ! -f "$EDS_REPO/scripts/aem-embed.js" ]; then
    echo "error: $EDS_REPO does not look like the app's EDS repo (needs blocks/ and scripts/aem-embed.js)." >&2
    exit 1
fi

BLOCK_DIR="$EDS_REPO/blocks/$ACTION_NAME"
if [ -e "$BLOCK_DIR" ]; then
    echo "error: $BLOCK_DIR already exists. Edit it instead." >&2
    exit 1
fi

ACTION_TITLE="$(echo "$ACTION_NAME" | awk -F- '{for (i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1' OFS=' ')"

mkdir -p "$BLOCK_DIR"
for ext in js css; do
    sed -e "s|<ACTION_NAME>|$ACTION_NAME|g" -e "s|<ACTION_TITLE>|$ACTION_TITLE|g" \
        "$ASSETS_DIR/eds-block-template.$ext" > "$BLOCK_DIR/$ACTION_NAME.$ext"
    echo "created $BLOCK_DIR/$ACTION_NAME.$ext"
done

cat <<EOF

Next steps (EDS repo):
  1. Implement render() in blocks/$ACTION_NAME/$ACTION_NAME.js against the handler's
     structuredContent, and keep PREVIEW_RESULT shaped the same.
  2. Preview the block without any content page:
       cd $EDS_REPO && npx -y @adobe/aem-cli up
       open http://localhost:3000/tools/widget-preview.html?block=$ACTION_NAME
  3. Lint: npm run lint  (in the EDS repo)
  4. Push the EDS repo (merging to main ships the block code).

Then the USER must (not doable from code):
  5. Create and publish an EDS page whose only content is a block table named
     "$ACTION_NAME" (one header row "$ACTION_NAME", one empty row).
  6. In the llm-apps UI > action > LLM Widget details: Widget type "Edge Delivery Services block",
     Script URL  https://main--<repo>--<owner>.aem.live/scripts/aem-embed.js
     Widget URL  https://main--<repo>--<owner>.aem.live/<page-path>
     and add the EDS origin to the CSP domains.
  Full filled-in instructions: references/user-guide.md (section 2).
EOF
