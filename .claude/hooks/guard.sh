#!/usr/bin/env bash
# PreToolUse guard: blocks edits to secrets and production-affecting commands.
# Exit 2 = block; stderr is shown to Claude as the reason.
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")

if [[ "$tool" == "Edit" || "$tool" == "Write" || "$tool" == "MultiEdit" ]]; then
  path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
  case "$path" in
    *.env|*.env.*|*/.dev.vars|*/.dev.vars.*)
      if [[ "$path" != *.example ]]; then
        echo "Diblokir: file secret ($path) tidak boleh diubah oleh Claude. Minta pemilik mengubahnya." >&2
        exit 2
      fi
      ;;
  esac
fi

if [[ "$tool" == "Bash" ]]; then
  cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
  if grep -Eq '(wrangler|cf)[^|;&]*(deploy|publish)[^|;&]*(--env[ =]production|-e[ =]production)' <<<"$cmd"; then
    echo "Diblokir: deploy production hanya atas perintah pemilik (lihat docs/workflow.md)." >&2
    exit 2
  fi
  # Any D1 command or project db:* script aimed at a remote database (incl. --no-local --remote).
  if grep -Eq '(\bd1\b|db:(migrate|seed|generate))' <<<"$cmd" && grep -Eq -- '--remote\b' <<<"$cmd"; then
    echo "Diblokir: operasi D1 remote hanya lewat CI." >&2
    exit 2
  fi
  if grep -Eq 'wrangler[^|;&]*secret (put|delete)' <<<"$cmd"; then
    echo "Diblokir: secret dikelola pemilik." >&2
    exit 2
  fi
  if grep -Eq 'git push' <<<"$cmd" && grep -Eq '(--force|--force-with-lease| -f( |$))' <<<"$cmd" && grep -Eq '(main|master)' <<<"$cmd"; then
    echo "Diblokir: force push ke main." >&2
    exit 2
  fi
fi

exit 0
