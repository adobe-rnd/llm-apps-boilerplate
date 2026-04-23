#!/usr/bin/env bash
#
# scaffold-action.sh -- create a new action directory for the llm-apps boilerplate.
#
# Usage:
#   bash .claude/skills/llm-apps-action-author/scripts/scaffold-action.sh <action-name> [--widget]
#
# Creates:
#   actions/<action-name>/index.js         (from assets/handler-template.js)
#   actions/<action-name>/widget.html      (from assets/widget-template.html, if --widget)
#   test/actions/<action-name>.test.js     (from assets/handler-test-template.js)
#
# Zero dependencies beyond bash + coreutils.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets"

REPO_ROOT="$(pwd)"

print_usage() {
    cat <<EOF
Usage: $0 <action-name> [--widget]

  <action-name>  kebab-case name, matches /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
  --widget       also create widget.html (and use the with-widget handler template)

Example:
  $0 weather-lookup
  $0 weather-lookup --widget
EOF
}

if [ "$#" -lt 1 ]; then
    print_usage
    exit 1
fi

ACTION_NAME=""
WITH_WIDGET=0

for arg in "$@"; do
    case "$arg" in
        --widget)
            WITH_WIDGET=1
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        -*)
            echo "error: unknown flag: $arg" >&2
            print_usage
            exit 1
            ;;
        *)
            if [ -n "$ACTION_NAME" ]; then
                echo "error: only one action name allowed" >&2
                exit 1
            fi
            ACTION_NAME="$arg"
            ;;
    esac
done

if [ -z "$ACTION_NAME" ]; then
    echo "error: action name is required" >&2
    print_usage
    exit 1
fi

if ! [[ "$ACTION_NAME" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]]; then
    echo "error: action name must be kebab-case: lowercase letters, digits, single hyphens." >&2
    echo "       got: '$ACTION_NAME'" >&2
    exit 1
fi

if [ ! -d "$REPO_ROOT/actions" ]; then
    echo "error: actions/ directory not found in $REPO_ROOT." >&2
    echo "       run this script from the llm-apps boilerplate repo root." >&2
    exit 1
fi

TARGET_DIR="$REPO_ROOT/actions/$ACTION_NAME"

if [ -e "$TARGET_DIR" ]; then
    echo "error: $TARGET_DIR already exists. Delete it or choose another name." >&2
    exit 1
fi

mkdir -p "$TARGET_DIR"

if [ "$WITH_WIDGET" -eq 1 ]; then
    HANDLER_TEMPLATE="$ASSETS_DIR/handler-with-widget-template.js"
    WIDGET_TEMPLATE="$ASSETS_DIR/widget-template.html"
else
    HANDLER_TEMPLATE="$ASSETS_DIR/handler-template.js"
    WIDGET_TEMPLATE=""
fi

if [ ! -f "$HANDLER_TEMPLATE" ]; then
    echo "error: handler template not found: $HANDLER_TEMPLATE" >&2
    exit 1
fi

# POSIX-portable substitution (macOS sed and GNU sed both accept -e).
sed -e "s|<ACTION_NAME>|$ACTION_NAME|g" "$HANDLER_TEMPLATE" > "$TARGET_DIR/index.js"
echo "created $TARGET_DIR/index.js"

if [ "$WITH_WIDGET" -eq 1 ]; then
    if [ ! -f "$WIDGET_TEMPLATE" ]; then
        echo "error: widget template not found: $WIDGET_TEMPLATE" >&2
        exit 1
    fi
    sed -e "s|<ACTION_NAME>|$ACTION_NAME|g" "$WIDGET_TEMPLATE" > "$TARGET_DIR/widget.html"
    echo "created $TARGET_DIR/widget.html"
fi

TEST_TEMPLATE="$ASSETS_DIR/handler-test-template.js"
TEST_DIR="$REPO_ROOT/test/actions"
TEST_FILE="$TEST_DIR/$ACTION_NAME.test.js"

if [ ! -f "$TEST_TEMPLATE" ]; then
    echo "error: test template not found: $TEST_TEMPLATE" >&2
    exit 1
fi

mkdir -p "$TEST_DIR"

if [ -e "$TEST_FILE" ]; then
    echo "warn: $TEST_FILE already exists; not overwriting." >&2
else
    sed -e "s|<ACTION_NAME>|$ACTION_NAME|g" "$TEST_TEMPLATE" > "$TEST_FILE"
    echo "created $TEST_FILE"
fi

# Seed actions.json with a minimal placeholder entry so args flow to the handler
# during local smoke tests. Without an inputSchema entry the MCP SDK registers the
# tool with an empty Zod schema and strips every argument before calling the handler.
ACTIONS_JSON="$REPO_ROOT/actions.json"
node -e "
const fs = require('fs');
const name = '$ACTION_NAME';
const file = '$ACTIONS_JSON';

let data = { actions: [] };
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
if (!Array.isArray(data.actions)) data.actions = [];

if (data.actions.some(a => a.name === name)) {
    process.stdout.write('actions.json already has an entry for ' + name + ' — skipping\n');
    process.exit(0);
}

const title = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
data.actions.push({
    name,
    title,
    description: 'TODO: set in the llm-apps UI',
    inputSchema: { type: 'object', properties: {}, required: [] }
});

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
process.stdout.write('updated actions.json — add inputSchema properties before smoke testing\n');
"

cat <<EOF

Next steps:
  1. Open $TARGET_DIR/index.js and implement the handler.
  2. Open $TEST_FILE and flesh out the tests (happy path + edge cases).
     Run them with:  npx jest test/actions/$ACTION_NAME
  3. Add your input properties to the $ACTION_NAME entry in actions.json so args
     flow through to the handler during local testing.
  4. Smoke test:
       npm run dev:local   # local Node HTTP server (no Adobe credentials)
       # or
       npm run dev         # deploys to I/O Runtime
     Then verify via MCP Inspector, Claude Desktop, or curl.
  5. Author the full metadata (title, description, inputSchema, annotations) in the
     llm-apps UI, then click "Download actions.json" to replace the local placeholder.

Validate the handler shape before shipping:
  node .claude/skills/llm-apps-action-author/scripts/validate-handler.js actions/$ACTION_NAME/index.js
EOF
