# Triage Labels — this repo

**The triage label mapping is shared doctrine**, provided by the `harness` plugin at
`${CLAUDE_PLUGIN_ROOT}/docs/agents/triage-labels.md`.

This repo adds nothing to it. The labels are **workspace** labels in the shared
**Development** workspace, so `frontend-harness` and `python-harness` see one set — there is
no per-repo copy to keep in step, which is why there is nothing below this line.

An earlier version of this file said the two repos sat on different workspaces with separate
label copies. They do not: both reach Linear through the same Docker MCP gateway.
