#!/bin/sh
# Refreshes the local Supabase database with a clean schema (from
# supabase/migrations/) and the latest real data from supa.bgs.mn (production).
#
# Usage:
#   export SUPA_BGS_MN_PG_PASSWORD='...'          # POSTGRES_PASSWORD, from the password manager
#   export SUPA_BGS_MN_SSH_KEY=~/.ssh/<your-key>  # your own SSH private key for the server
#   export SUPA_BGS_MN_SSH_HOST='<user>@<host>'   # from the password manager
#   ./scripts/refresh-local-data.sh
#
# See DEVELOPMENT.md for background on this workflow and its gotchas.

set -e

SSH_HOST="$SUPA_BGS_MN_SSH_HOST"
SSH_KEY="$SUPA_BGS_MN_SSH_KEY"
TUNNEL_PORT=5433
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

if [ -z "$SUPA_BGS_MN_PG_PASSWORD" ]; then
  echo "Set SUPA_BGS_MN_PG_PASSWORD (the supa.bgs.mn POSTGRES_PASSWORD) before running this." >&2
  exit 1
fi

if [ -z "$SSH_KEY" ]; then
  echo "Set SUPA_BGS_MN_SSH_KEY to the path of your own SSH private key for the server." >&2
  exit 1
fi

if [ -z "$SSH_HOST" ]; then
  echo "Set SUPA_BGS_MN_SSH_HOST to '<user>@<host>' for the production server (see the password manager)." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running — start Docker Desktop first." >&2
  exit 1
fi

echo "==> Opening SSH tunnel to supa.bgs.mn (port $TUNNEL_PORT)..."
TUNNEL_STARTED=0
if ! lsof -ti:$TUNNEL_PORT >/dev/null 2>&1; then
  ssh -f -N -L "$TUNNEL_PORT:localhost:$TUNNEL_PORT" -i "$SSH_KEY" "$SSH_HOST"
  TUNNEL_STARTED=1
fi

cleanup_tunnel() {
  if [ "$TUNNEL_STARTED" = "1" ]; then
    pid=$(lsof -ti:$TUNNEL_PORT 2>/dev/null || true)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  fi
}
trap 'cleanup_tunnel; rm -rf "$WORKDIR"' EXIT

echo "==> Dumping application data from supa.bgs.mn..."
ssh -i "$SSH_KEY" "$SSH_HOST" \
  'docker exec supabase-db pg_dump -h localhost -p 5433 -U supabase_admin -d postgres \
    --data-only --no-owner --disable-triggers \
    --schema=public --schema=bgs_attendance --schema=target --schema=mobile \
    -f /tmp/refresh_data.sql'

ssh -i "$SSH_KEY" "$SSH_HOST" \
  'docker exec supabase-db pg_dump -h localhost -p 5433 -U supabase_admin -d postgres \
    --data-only --no-owner --disable-triggers \
    --table=auth.users --table=auth.identities --table=storage.objects \
    -f /tmp/refresh_auth_storage.sql'

ssh -i "$SSH_KEY" "$SSH_HOST" \
  'docker cp supabase-db:/tmp/refresh_data.sql /tmp/refresh_data.sql && \
   docker cp supabase-db:/tmp/refresh_auth_storage.sql /tmp/refresh_auth_storage.sql'

scp -i "$SSH_KEY" "$SSH_HOST:/tmp/refresh_data.sql" "$WORKDIR/data.sql"
scp -i "$SSH_KEY" "$SSH_HOST:/tmp/refresh_auth_storage.sql" "$WORKDIR/auth_storage.sql"

# pg_dump 17 prepends \restrict/\unrestrict meta-commands, which the local
# psql rejects when run non-interactively — strip them. (BSD sed -i needs the
# empty '' extension arg; on Linux/GNU sed drop it.)
sed -i '' -E '/^\\(un)?restrict /d' "$WORKDIR/data.sql" "$WORKDIR/auth_storage.sql"

echo "==> Resetting local database to a clean schema..."
npx supabase db reset

echo "==> Recreating storage buckets..."
LOCAL_SECRET_KEY=$(npx supabase status -o json | python3 -c "import json,sys; print(json.load(sys.stdin)['SECRET_KEY'])")

create_bucket() {
  name="$1"; public="$2"; limit="$3"; mimes="$4"
  body=$(python3 -c "
import json
d = {'id': '$name', 'name': '$name', 'public': $public}
if '$limit':
    d['file_size_limit'] = int('$limit')
if '''$mimes''':
    d['allowed_mime_types'] = '''$mimes'''.split(',')
print(json.dumps(d))
")
  curl -s -o /dev/null -w "  %-28s %{http_code}\n" "$name" \
    -X POST "http://127.0.0.1:54321/storage/v1/bucket" \
    -H "Authorization: Bearer $LOCAL_SECRET_KEY" -H "apikey: $LOCAL_SECRET_KEY" \
    -H "Content-Type: application/json" -d "$body"
}
create_bucket "avatars" "True" "" ""
create_bucket "chat-media" "True" "" ""
create_bucket "order-item-bucket" "True" "5242880" ""
create_bucket "order-purchase-quotes" "False" "31457280" "application/pdf,image/jpeg,image/png,image/webp"
create_bucket "order-purchase-documents" "False" "31457280" "application/pdf,image/jpeg,image/png,image/webp"
create_bucket "attendance-attachments" "False" "5242880" "image/jpeg,image/png,application/pdf"
create_bucket "policy-legal-acts" "False" "20971520" "application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
create_bucket "leave-attachments" "False" "" ""

echo "==> Restoring auth/storage data..."
docker exec -i supabase_db_bgs.mn psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0 < "$WORKDIR/auth_storage.sql"

echo "==> Restoring application data..."
docker exec -i supabase_db_bgs.mn psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0 < "$WORKDIR/data.sql"

echo "==> Done. Local Studio: http://127.0.0.1:54323"
