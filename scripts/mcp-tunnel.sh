#!/bin/sh
# Opens the SSH tunnel required to use the self-hosted Supabase MCP server.
#
# The MCP endpoint (Studio's /api/mcp) is intentionally not reachable from the
# internet — Studio is bound to the production server's localhost only, and the
# only way in is this tunnel. Claude Code's "supabase-selfhost" MCP server
# expects it at http://localhost:8080/api/mcp — run this first, keep it running.
#
# Usage:
#   export SUPA_BGS_MN_SSH_KEY=~/.ssh/<your-key>  # your own SSH private key for the server
#   export SUPA_BGS_MN_SSH_HOST='<user>@<host>'   # from the password manager
#   ./scripts/mcp-tunnel.sh
set -eu

if [ -z "${SUPA_BGS_MN_SSH_KEY:-}" ]; then
  echo "Set SUPA_BGS_MN_SSH_KEY to the path of your own SSH private key for the server." >&2
  exit 1
fi

if [ -z "${SUPA_BGS_MN_SSH_HOST:-}" ]; then
  echo "Set SUPA_BGS_MN_SSH_HOST to '<user>@<host>' for the production server (see the password manager)." >&2
  exit 1
fi

exec ssh -i "$SUPA_BGS_MN_SSH_KEY" -N \
  -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
  -L 8080:localhost:3005 "$SUPA_BGS_MN_SSH_HOST"
