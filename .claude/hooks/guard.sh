#!/usr/bin/env bash
# PreToolUse guard: blocks edits to secrets and production-affecting commands.
# Exit 2 = block; stderr is shown to Claude as the reason. Tested by tests/guard-hook.test.ts.
# The whole command text is checked at once, so an unrelated mention (e.g. a commit message)
# can cause a false block; that fails safe. Patterns use POSIX classes (GNU and BSD grep).
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // empty' <<<"$input")

block() {
  echo "Diblokir: $1" >&2
  exit 2
}

if [[ "$tool" == "Edit" || "$tool" == "Write" || "$tool" == "MultiEdit" ]]; then
  path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
  case "$path" in
    *.env|*.env.*|*/.dev.vars|*/.dev.vars.*)
      if [[ "$path" != *.example ]]; then
        block "file secret ($path) tidak boleh diubah oleh Claude. Minta pemilik mengubahnya."
      fi
      ;;
  esac
fi

if [[ "$tool" == "Bash" ]]; then
  cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
  has() { grep -Eq -- "$1" <<<"$cmd"; }

  W='([^[:alnum:]_]|$)'            # end of word
  D1='(^|[^[:alnum:]_])d1'"$W"     # the word "d1"
  REMOTE='--remote([^[:alnum:]_-]|$)'
  PROD_ENV="(--env|-e)[[:space:]=]*[\"']?production"

  # --- Production: deploy, versions, rollback, delete, triggers (owner only) ---
  if has 'wrangler' && has '(deploy|versions|rollback|delete|triggers)' && has "$PROD_ENV"; then
    block "deploy/perubahan production hanya atas perintah pemilik (lihat docs/workflow.md)."
  fi
  if has "CLOUDFLARE_ENV=[\"']?production"; then
    block "CLOUDFLARE_ENV=production hanya dipakai CI/pemilik (lihat docs/adr/0011-lingkungan-cloudflare.md)."
  fi
  # A web build for production makes a plain `wrangler deploy` target production.
  web_build="${CLAUDE_PROJECT_DIR:-.}/apps/web/dist/client/wrangler.json"
  if [[ -f "$web_build" ]] && grep -Eq '"targetEnvironment"[[:space:]]*:[[:space:]]*"production"' "$web_build" \
    && has 'wrangler' && has '(deploy|versions)'; then
    block "hasil build web menargetkan production; deploy hanya atas perintah pemilik."
  fi

  # --- Remote databases (CI only) ---
  if has "(^|[^[:alnum:]_])d1[[:space:]]+(create|delete|info|list|insights|time-travel)([^[:alnum:]_-]|$)"; then
    block "subperintah D1 ini selalu bekerja pada database remote; hanya lewat CI/pemilik."
  fi
  if { has "$D1" || has 'db:(migrate|seed|generate)'; } && has "$REMOTE"; then
    block "operasi D1 remote hanya lewat CI."
  fi
  if has 'wrangler' && has "(^|[[:space:]])dev$W" && has "$REMOTE"; then
    block "wrangler dev --remote memakai resource Cloudflare sungguhan; jalankan lokal saja."
  fi

  # --- Secrets and history ---
  if has 'wrangler[^|;&]*secret[[:space:]]+(put|delete|bulk)'; then
    block "secret dikelola pemilik."
  fi
  if has 'git push' && has '(--force|--force-with-lease| -f( |$))' && has '(main|master)'; then
    block "force push ke main."
  fi
fi

exit 0
