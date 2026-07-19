#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

slug=""
base_dir="${BENEFIT_HQ_TENANTS_DIR:-$(cd "$repo_root/.." && pwd)/benefit-hq-tenants}"
domain="${BENEFIT_HQ_DOMAIN:-benefit-hq.com}"
port=""
service_name=""
database_url=""
db_host="127.0.0.1"
db_port="5432"
db_superuser="postgres"
db_name=""
db_user=""
storage_root="/var/lib/benefit-hq/tenants"
remote="origin"
skip_checks=0
install_service=1
current_step="initialization"

usage() {
  cat <<'EOF'
Usage: scripts/provision-tenant.sh <slug> [options]

Provision a new, fully isolated Benefit HQ tenant: its own Postgres database,
its own checkout, its own systemd service, and its own port, ready to sit
behind a Caddy block for <slug>.<domain>. Run this from the primary Benefit HQ
checkout (the one with the git remote to clone from).

Each tenant is a separate process and a separate database — there is no
shared state between tenants. This mirrors how the primary instance already
runs; it does not change the application's data model.

Arguments:
  slug                 subdomain label, e.g. "acme" for acme.benefit-hq.com

Options:
  --base-dir DIR        parent directory for tenant checkouts
                         (default: BENEFIT_HQ_TENANTS_DIR, or a
                         "benefit-hq-tenants" directory next to this checkout)
  --domain DOMAIN        base domain for the printed Caddy snippet (default: benefit-hq.com)
  --port PORT             port for this tenant (default: next unused port after
                         3030, tracked in <base-dir>/tenants.tsv)
  --service NAME          systemd unit name (default: benefit-hq-tenant-<slug>.service)
  --database-url URL      use this connection string verbatim and skip local
                         database provisioning (for managed/remote Postgres)
  --db-host HOST          Postgres host for provisioning (default: 127.0.0.1)
  --db-port PORT          Postgres port for provisioning (default: 5432)
  --db-superuser NAME     Postgres role used to create the tenant role and
                         database; must already exist and be reachable with
                         your current client auth (.pgpass, PGPASSWORD, peer
                         auth, etc.) (default: postgres)
  --db-name NAME          database name to create (default: benefit_hq_<slug>)
  --db-user NAME          database role to create (default: same as --db-name)
  --storage-root DIR      parent directory for per-tenant STORAGE_DIR
                         (default: /var/lib/benefit-hq/tenants)
  --remote NAME           git remote to clone from (default: origin)
  --skip-checks           pass --skip-checks through to deploy-release.sh
  --no-service            provision the database and checkout only; skip
                         installing and starting the systemd service
  -h, --help              show this help

Environment equivalents:
  BENEFIT_HQ_TENANTS_DIR
  BENEFIT_HQ_DOMAIN
EOF
}

fail() {
  printf 'Provisioning stopped: %s\n' "$1" >&2
  printf 'Failed during: %s\n' "$current_step" >&2
  exit 1
}

run_step() {
  current_step="$1"
  shift
  printf '\n==> %s\n' "$current_step"
  "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-dir)
      [[ $# -ge 2 ]] || fail "--base-dir requires a value"
      base_dir="$2"
      shift 2
      ;;
    --domain)
      [[ $# -ge 2 ]] || fail "--domain requires a value"
      domain="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || fail "--port requires a value"
      port="$2"
      shift 2
      ;;
    --service)
      [[ $# -ge 2 ]] || fail "--service requires a value"
      service_name="$2"
      shift 2
      ;;
    --database-url)
      [[ $# -ge 2 ]] || fail "--database-url requires a value"
      database_url="$2"
      shift 2
      ;;
    --db-host)
      [[ $# -ge 2 ]] || fail "--db-host requires a value"
      db_host="$2"
      shift 2
      ;;
    --db-port)
      [[ $# -ge 2 ]] || fail "--db-port requires a value"
      db_port="$2"
      shift 2
      ;;
    --db-superuser)
      [[ $# -ge 2 ]] || fail "--db-superuser requires a value"
      db_superuser="$2"
      shift 2
      ;;
    --db-name)
      [[ $# -ge 2 ]] || fail "--db-name requires a value"
      db_name="$2"
      shift 2
      ;;
    --db-user)
      [[ $# -ge 2 ]] || fail "--db-user requires a value"
      db_user="$2"
      shift 2
      ;;
    --storage-root)
      [[ $# -ge 2 ]] || fail "--storage-root requires a value"
      storage_root="$2"
      shift 2
      ;;
    --remote)
      [[ $# -ge 2 ]] || fail "--remote requires a value"
      remote="$2"
      shift 2
      ;;
    --skip-checks)
      skip_checks=1
      shift
      ;;
    --no-service)
      install_service=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      fail "unknown option: $1"
      ;;
    *)
      [[ -z "$slug" ]] || fail "unexpected extra argument: $1"
      slug="$1"
      shift
      ;;
  esac
done

[[ ${EUID:-$(id -u)} -ne 0 ]] || \
  fail "run this script without sudo; nested steps request sudo only when required"

[[ -n "$slug" ]] || fail "missing required argument: slug (see --help)"
[[ "$slug" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || \
  fail "invalid slug: $slug (lowercase letters, digits, and hyphens only, matching a DNS label)"
case "$slug" in
  www|api|admin|mail|ftp|ns1|ns2)
    fail "$slug is a reserved subdomain label; choose a different slug"
    ;;
esac

current_step="checking required commands"
required_commands=(git npm node openssl curl)
[[ -n "$database_url" ]] || required_commands+=(psql)
for required_command in "${required_commands[@]}"; do
  command -v "$required_command" >/dev/null 2>&1 || fail "missing required command: $required_command"
done

db_slug="${slug//-/_}"
[[ -n "$db_name" ]] || db_name="benefit_hq_${db_slug}"
[[ -n "$db_user" ]] || db_user="$db_name"
[[ -n "$service_name" ]] || service_name="benefit-hq-tenant-${slug}.service"
[[ "$service_name" =~ ^[A-Za-z0-9_.@-]+\.service$ ]] || \
  fail "invalid --service name: $service_name"

tenant_dir="$base_dir/$slug"
storage_dir="$storage_root/$slug"
registry_file="$base_dir/tenants.tsv"

current_step="validating tenant does not already exist"
[[ ! -e "$tenant_dir" ]] || fail "$tenant_dir already exists"
if [[ -f "$registry_file" ]] && awk -F'\t' -v s="$slug" 'NR>1 && $1==s{found=1} END{exit !found}' "$registry_file"; then
  fail "$slug is already recorded in $registry_file"
fi

if [[ -z "$port" ]]; then
  next_port=3031
  if [[ -f "$registry_file" ]]; then
    max_port="$(awk -F'\t' 'NR>1 && $3+0>max{max=$3+0} END{print max+0}' "$registry_file")"
    [[ "$max_port" -lt 3031 ]] || next_port=$((max_port + 1))
  fi
  port="$next_port"
fi
[[ "$port" =~ ^[0-9]+$ && "$port" -ge 1 && "$port" -le 65535 ]] || fail "invalid port: $port"
if [[ -f "$registry_file" ]] && awk -F'\t' -v p="$port" 'NR>1 && $3==p{found=1} END{exit !found}' "$registry_file"; then
  fail "port $port is already recorded in $registry_file; pick another with --port"
fi

printf 'Provisioning tenant "%s"\n' "$slug"
printf '  Checkout:    %s\n' "$tenant_dir"
printf '  Subdomain:   %s.%s\n' "$slug" "$domain"
printf '  Port:        %s\n' "$port"
printf '  Service:     %s\n' "$service_name"
printf '  Storage dir: %s\n' "$storage_dir"
if [[ -z "$database_url" ]]; then
  printf '  Database:    %s (role %s on %s:%s)\n' "$db_name" "$db_user" "$db_host" "$db_port"
else
  printf '  Database:    using --database-url as given\n'
fi

if [[ -z "$database_url" ]]; then
  current_step="generating a database password"
  db_password="$(openssl rand -base64 24)"

  run_step "Creating Postgres role $db_user" \
    psql -v ON_ERROR_STOP=1 --host="$db_host" --port="$db_port" --username="$db_superuser" \
      --dbname=postgres -c "CREATE ROLE \"$db_user\" LOGIN PASSWORD '$db_password';"

  run_step "Creating Postgres database $db_name" \
    psql -v ON_ERROR_STOP=1 --host="$db_host" --port="$db_port" --username="$db_superuser" \
      --dbname=postgres -c "CREATE DATABASE \"$db_name\" OWNER \"$db_user\";"

  database_url="postgresql://$db_user:$db_password@$db_host:$db_port/$db_name"
fi

current_step="resolving the git remote to clone"
origin_url="$(git -C "$repo_root" remote get-url "$remote")" || \
  fail "git remote \"$remote\" is not configured in $repo_root"

run_step "Creating $base_dir" install -d -m 0755 "$base_dir"
run_step "Cloning $origin_url" git clone "$origin_url" "$tenant_dir"

current_step="generating secrets"
auth_secret="$(openssl rand -base64 32)"
bootstrap_token="$(openssl rand -base64 32)"

current_step="writing the tenant .env file"
(
  umask 077
  cat >"$tenant_dir/.env" <<EOF
# Generated by scripts/provision-tenant.sh for tenant "$slug" on $(date -u +%Y-%m-%dT%H:%M:%SZ)
DATABASE_URL="$database_url"
AUTH_SECRET="$auth_secret"
BOOTSTRAP_TOKEN="$bootstrap_token"
STORAGE_DIR="$storage_dir"
EOF
)

run_step "Creating $storage_dir" install -d -m 0700 "$storage_dir"

deploy_args=(--no-restart)
[[ $skip_checks -eq 0 ]] || deploy_args+=(--skip-checks)
run_step "Building and migrating the tenant checkout" \
  bash -c 'cd "$1" && shift && ./scripts/deploy-release.sh "$@"' _ "$tenant_dir" "${deploy_args[@]}"

if [[ $install_service -eq 1 ]]; then
  run_step "Installing the $service_name systemd service" \
    bash -c 'cd "$1" && shift && ./scripts/install-systemd-service.sh "$@"' _ "$tenant_dir" \
      --service "$service_name" --port "$port"
fi

current_step="recording the tenant in the registry"
if [[ ! -f "$registry_file" ]]; then
  printf 'slug\tdomain\tport\tservice\tdb_name\tdirectory\tcreated_at\n' >"$registry_file"
fi
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$slug" "$domain" "$port" "$service_name" "$db_name" "$tenant_dir" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >>"$registry_file"

printf '\nTenant "%s" provisioned successfully.\n' "$slug"
printf '\nAdd this block to your Caddyfile inside the *.%s site (or as its own site\n' "$domain"
printf 'block), then reload Caddy yourself — this script does not touch Caddy:\n\n'
cat <<EOF
    @$slug host $slug.$domain
    handle @$slug {
        reverse_proxy 127.0.0.1:$port
    }
EOF
printf '\nNo DNS change is needed if *.%s is already a wildcard record.\n' "$domain"
printf '\nTo finish setup, open https://%s.%s/register and enter the BOOTSTRAP_TOKEN\n' "$slug" "$domain"
printf 'from %s/.env, then remove BOOTSTRAP_TOKEN from that file once the first\n' "$tenant_dir"
printf 'administrator exists.\n'
printf '\nTenant record appended to: %s\n' "$registry_file"
