#!/usr/bin/env bash
#
# scaffold-action.sh -- create a new action directory for the llm-apps boilerplate.
#
# Usage:
#   bash .claude/skills/llm-apps-action-author/scripts/scaffold-action.sh <action-name> \
#        [--eds | --widget] [--param name:type[:required]]...
#
# Creates:
#   actions/<action-name>/index.js         (handler-template.js, or handler-with-widget-template.js
#                                           with --eds / --widget)
#   actions/<action-name>/widget.html      (from assets/widget-template.html, only with --widget)
#   test/actions/<action-name>.test.js     (from assets/handler-test-template.js)
#   test/fixtures/<action-name>/example.json  (example arguments, typed placeholders from --param)
#   actions.json                           (local placeholder entry, inputSchema seeded from --param)
#
# The EDS block for --eds is created separately in the EDS repo by scaffold-eds-block.sh.
#
# Zero dependencies beyond bash + coreutils.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets"

REPO_ROOT="$(pwd)"

print_usage() {
    cat <<EOF
Usage: $0 <action-name> [--eds | --widget] [--param name:type[:required]]...

  <action-name>  the action's Code identifier from the llm-apps UI (kebab-case,
                 /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/)
  --eds          widget is an EDS block (handler returns structuredContent; NO widget.html,
                 because a widget.html would override the EDS widget)
  --widget       custom self-contained widget: also create actions/<name>/widget.html
  --param        an input parameter as configured in the UI. type is one of
                 string|number|integer|boolean|object|array. Append :required if required.
                 Repeat for each parameter.

Examples:
  $0 weather-lookup
  $0 weather-lookup --eds --param city:string:required --param units:string
  $0 weather-lookup --widget
EOF
}

if [ "$#" -lt 1 ]; then
    print_usage
    exit 1
fi

ACTION_NAME=""
WITH_WIDGET=0
WITH_EDS=0
PARAMS=()

while [ "$#" -gt 0 ]; do
    arg="$1"
    shift
    case "$arg" in
        --widget)
            WITH_WIDGET=1
            ;;
        --eds)
            WITH_EDS=1
            ;;
        --param)
            if [ "$#" -eq 0 ]; then
                echo "error: --param needs a value: name:type[:required]" >&2
                exit 1
            fi
            if ! [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*:(string|number|integer|boolean|object|array)(:required)?$ ]]; then
                echo "error: invalid --param '$1'. Expected name:type[:required]," >&2
                echo "       type one of string|number|integer|boolean|object|array." >&2
                exit 1
            fi
            PARAMS+=("$1")
            shift
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

if [ "$WITH_WIDGET" -eq 1 ] && [ "$WITH_EDS" -eq 1 ]; then
    echo "error: --eds and --widget are mutually exclusive (widget.html overrides the EDS widget)." >&2
    exit 1
fi

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
elif [ "$WITH_EDS" -eq 1 ]; then
    HANDLER_TEMPLATE="$ASSETS_DIR/handler-with-widget-template.js"
    WIDGET_TEMPLATE=""
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
PARAMS_CSV="$(IFS=,; echo "${PARAMS[*]:-}")"
node -e "
const fs = require('fs');
const name = '$ACTION_NAME';
const file = '$ACTIONS_JSON';
const params = '$PARAMS_CSV'.split(',').filter(Boolean).map((p) => {
    const [pname, type, req] = p.split(':');
    return { pname, type, required: req === 'required' };
});
const properties = {};
const required = [];
for (const p of params) {
    properties[p.pname] = { type: p.type, description: 'TODO: set in the llm-apps UI' };
    if (p.required) required.push(p.pname);
}

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
    inputSchema: { type: 'object', properties, required }
});

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
process.stdout.write('updated actions.json (local placeholder, ' + params.length + ' param(s) in inputSchema)\n');
"

# Example arguments shared by the handler test and check-action.js. Placeholders only:
# replace them with realistic values.
FIXTURE_DIR="$REPO_ROOT/test/fixtures/$ACTION_NAME"
if [ -e "$FIXTURE_DIR/example.json" ]; then
    echo "warn: $FIXTURE_DIR/example.json already exists; not overwriting." >&2
else
    mkdir -p "$FIXTURE_DIR"
    node -e "
const fs = require('fs');
const samples = { string: 'example', number: 1, integer: 1, boolean: true, object: {}, array: [] };
const args = {};
for (const p of '$PARAMS_CSV'.split(',').filter(Boolean)) {
    const [name, type] = p.split(':');
    args[name] = samples[type];
}
fs.writeFileSync('$FIXTURE_DIR/example.json', JSON.stringify({ arguments: args }, null, 2) + '\n');
"
    echo "created $FIXTURE_DIR/example.json"
fi

cat <<EOF

Next steps:
  1. Open $TARGET_DIR/index.js and implement the handler.
  2. Put realistic arguments in test/fixtures/$ACTION_NAME/example.json, then flesh out
     $TEST_FILE (happy path + every branch).
     Run them with:  npx jest test/actions/$ACTION_NAME
  3. Check the $ACTION_NAME inputSchema in actions.json matches the UI parameters
     (pass --param flags to seed it), otherwise args are stripped during local testing.
  4. Smoke test:
       npm run dev:local   # local Node HTTP server (no Adobe credentials)
       # or
       npm run dev         # deploys to I/O Runtime
     Then verify via MCP Inspector, Claude Desktop, or curl.
  5. Author the full metadata (title, description, inputSchema, annotations) in the
     llm-apps UI, then click "Download actions.json" to replace the local placeholder.

$( [ "$WITH_EDS" -eq 1 ] && printf '%s\n' "EDS widget: scaffold the block in the EDS repo:" \
  "  bash .claude/skills/llm-apps-action-author/scripts/scaffold-eds-block.sh $ACTION_NAME <path-to-eds-repo>" )

Final gate before shipping (handler + test + EDS block contract):
  node .claude/skills/llm-apps-action-author/scripts/check-action.js $ACTION_NAME
EOF
