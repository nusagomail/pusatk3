#!/usr/bin/env bash
# PostToolUse: format the edited file with Prettier when available. Never blocks.
input=$(cat)
path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[[ -z "$path" || ! -f "$path" ]] && exit 0

case "$path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.astro|*.json|*.md|*.css)
    cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
    if [[ -x node_modules/.bin/prettier ]]; then
      node_modules/.bin/prettier --write --log-level warn "$path" >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
