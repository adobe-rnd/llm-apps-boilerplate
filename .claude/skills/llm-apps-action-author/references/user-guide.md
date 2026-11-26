# Guiding the user

Part of every action happens outside the repos: in the **llm-apps UI** and the **EDS content
source**. The agent can't do those steps, so it must tell the user exactly what to do, with the
values filled in. Use this file twice:

- **Before coding** (Step 0): if the action doesn't exist in the UI yet, walk the user through
  [creating it](#1-create-the-action-in-the-llm-apps-ui), then continue with its Code identifier.
- **After coding** (Step 7): send the [hand-off message](#2-hand-off-message-after-the-code-is-done),
  filled in. Never end a widget action with only "done": the widget won't appear until the user
  completes these steps.

Fill every `<placeholder>` you can:

| Placeholder | Where to get it |
|---|---|
| `<id>` | The action's Code identifier |
| `<owner>` / `<eds-repo>` | `git -C <eds-repo-path> remote get-url origin` (e.g. `git@github.com:adobe-llm-apps/my-app-eds.git` -> owner `adobe-llm-apps`, repo `my-app-eds`) |
| `<page-path>` | Suggest `/<id>`; the user may pick another |
| `<api-origins>` | Every origin the block or handler-returned URLs load from (images, fetch). None for static widgets |

## 1. Create the action in the llm-apps UI

Send this when the user hasn't created the action yet (or isn't sure of its identifier):

> **Create the action in LLM Apps first**
>
> 1. Open your app > **Actions** > **Create Action**.
> 2. **Action details**
>    - **Action name**: a short task name, e.g. *Savings calculator*. The UI derives the
>      **Code identifier** (e.g. `savings-calculator`). It is fixed after creation and becomes the
>      handler folder, the tool name and the EDS block name, so tell me the exact value.
>    - **Description**: when the AI should use the action and what it returns, e.g. "Use this
>      action for any question about savings accounts. Returns ..." Be specific: the model uses it
>      to choose between actions.
>    - **Input parameters** > **Add parameter** for each value the handler needs: name, type
>      (String, Number, Integer, Boolean, Object, File), required, and a description of how to
>      extract it. Leave empty for an action without inputs.
>    - **LLM settings** (collapsed): annotations that are true for the action (read-only,
>      idempotent, open-world, destructive), short *invoking* / *invoked* status texts, and
>      visibility (**Expose to AI model**; **Show as widget in app surface** for widget actions).
> 3. **LLM Widget details**
>    - Text-only action: **Widget type** = *No interactive UI*.
>    - Widget action: **Widget type** = *Edge Delivery Services block*. You can fill the URLs
>      after the block and page exist; I'll give you the exact values at the end.
> 4. **Application Insights** / **ChatGPT Extensions**: defaults are fine for now.
> 5. Click **Create new action**. It appears with a *Not deployed* badge until you deploy.
>
> Then send me: the Code identifier, each parameter (name, type, required), whether it has a
> widget, and what it should do (data source / API, or "placeholder for now").

## 2. Hand-off message after the code is done

Send the variant that matches the action, with all values filled in. Include the
**Done** section with what you actually verified.

### Widget action (EDS block)

> **Done in code**
> - Handler: `actions/<id>/index.js` (+ `test/actions/<id>.test.js`, `test/fixtures/<id>/example.json`)
> - Widget block: `blocks/<id>/<id>.js` + `.css` in `<eds-repo>`
> - Verified: `check-action.js` (0 failures), `npm test`, lint in both repos, `tools/call` locally,
>   block preview at `/tools/widget-preview.html?block=<id>`.
>
> **Your steps (outside the code)**
> 1. **Push both repos** and merge: the handler repo and `<eds-repo>`. Merging the EDS repo to
>    `main` ships the block code.
> 2. **Create the widget page in EDS.** In your EDS content source (Document Authoring at
>    `https://da.live/#/<owner>/<eds-repo>`, or SharePoint / Google Drive), create a page at
>    `<page-path>` whose only content is a one-column table:
>
>    | <id> |
>    |---|
>    |  |
>
>    The header cell must be exactly `<id>`: that's how EDS knows to load the block.
>    **Preview**, then **Publish** the page.
>    Check it: `https://main--<eds-repo>--<owner>.aem.live<page-path>` should render the widget
>    with its sample data.
> 3. **Point the action at the page.** LLM Apps > your app > **Actions** > `<id>` >
>    **LLM Widget details**:
>    - **Widget type**: *Edge Delivery Services block*
>    - **Widget domain**: your app's widget sandbox origin (required to submit the app; unique per app)
>    - **Widget description**: one sentence on what the widget shows, so the AI doesn't repeat it
>    - **Template URLs** > **Script URL**: `https://main--<eds-repo>--<owner>.aem.live/scripts/aem-embed.js`
>    - **Template URLs** > **Widget URL**: `https://main--<eds-repo>--<owner>.aem.live<page-path>`
>    - **CSP Configuration**: add `https://main--<eds-repo>--<owner>.aem.live` to connect and
>      resource domains, plus `<api-origins>`
>    - In **Action details** > **LLM settings**, make sure **Show as widget in app surface** is on.
>
>    Click **Save changes**.
> 4. **Deploy** the app to Stage, then test it in ChatGPT or Claude with a prompt that should pick
>    this action (e.g. "<example prompt>") and one that shouldn't. Promote to Production after Stage works.
> 5. Optional, for local runs that mirror production: Actions page > **Download actions.json** >
>    replace the local `actions.json` in the handler repo.

### Text-only action

> **Done in code**
> - Handler: `actions/<id>/index.js` (+ test and example fixture). Verified: `check-action.js`,
>   `npm test`, `npm run lint`, `tools/call` locally.
>
> **Your steps**
> 1. Push and merge the handler repo.
> 2. In LLM Apps > **Actions** > `<id>` > **LLM Widget details**, confirm **Widget type** is
>    *No interactive UI*.
> 3. Deploy to Stage and test in ChatGPT or Claude; then promote to Production.

### Custom `widget.html` action

As the text-only variant, plus: in **LLM Widget details** > **CSP Configuration**, add
`https://esm.sh` (the SDK import) and `<api-origins>` to resource / connect domains. No EDS page.

## 3. When the user asks to change metadata

Name, description, parameters, annotations, widget URLs and CSP are edited only in the UI:
LLM Apps > **Actions** > `<id>` > the relevant tab > **Save changes**, then redeploy. If they
change a **parameter**, the handler, its tests and `example.json` must change too: offer to do it.
The Code identifier can't be changed: a new identifier means a new action (new handler folder
and new block).
