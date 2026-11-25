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
  # Starting the production workflow is gate 3 (owner only), also via gh.
  if has '(^|[[:space:]])gh[[:space:]]' && has '(workflow[[:space:]]+run|dispatches)' \
    && has '(deploy-production|Deploy production)'; then
    block "workflow deploy production hanya dijalankan pemilik (docs/workflow.md gerbang 3)."
  fi
  # A numeric workflow ID or a re-run hides which workflow it is; fail safe.
  if has '(^|[[:space:]])gh[[:space:]]' && has '(workflow[[:space:]]+run[[:space:]]+[0-9]+|workflows/[0-9]+/dispatches|run[[:space:]]+rerun|runs/[0-9]+/rerun)'; then
    block "memicu workflow lewat ID angka atau rerun bisa mengenai production; minta pemilik melakukannya."
  fi
  # A web build for production makes a plain `wrangler deploy` target production.
  web_build="${CLAUDE_PROJECT_DIR:-.}/apps/web/dist/client/wrangler.json"
  if [[ -f "$web_build" ]] && grep -Eq '"targetEnvironment"[[:space:]]*:[[:space:]]*"production"' "$web_build" \
    && has 'wrangler' && has '(deploy|versions)'; then
    block "hasil build web menargetkan production; deploy hanya atas perintah pemilik."
  fi

  # --- Remote databases (CI only) ---
  # Matched anywhere after "d1", so options in between (e.g. `d1 -c file delete`) do not hide it.
  # Fails safe: a local command that merely contains one of these words is also blocked.
  if has "$D1" && has "(^|[[:space:]])(create|delete|info|list|insights|time-travel)([^[:alnum:]_-]|$)"; then
    block "subperintah D1 ini selalu bekerja pada database remote; hanya lewat CI/pemilik."
  fi
  if { has "$D1" || has 'db:(migrate|seed|generate)'; } && has "$REMOTE"; then
    block "operasi D1 remote hanya lewat CI."
  fi
  # Any dev session with --remote or its alias -r (`pnpm dev` runs `wrangler dev` without the word).
  if has "(^|[[:space:]])dev$W" && has "(--remote|(^|[[:space:]])-r)([^[:alnum:]_-]|$)"; then
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
