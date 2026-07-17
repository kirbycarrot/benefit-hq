#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
service_name="${BENEFIT_HQ_SERVICE:-benefit-hq.service}"
health_url="${BENEFIT_HQ_HEALTH_URL:-http://127.0.0.1:3030/login}"
check_health=1
force=0
unit_temp=""

usage() {
  cat <<'EOF'
Usage: scripts/install-systemd-service.sh [options]

Create, enable, start, and verify the Benefit HQ systemd service.
Run this script as the Linux user that should own the application process. The
script requests sudo only for installing and managing the system service.

Options:
  --service NAME       systemd unit name (default: benefit-hq.service)
  --health-url URL     URL checked after startup (default: http://127.0.0.1:3030/login)
  --no-health-check    skip the post-start HTTP health check
  --force              replace an existing unit with the generated definition
  -h, --help           show this help

Environment equivalents:
  BENEFIT_HQ_SERVICE
  BENEFIT_HQ_HEALTH_URL
EOF
}

fail() {
  printf 'Service installation stopped: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [[ -n "$unit_temp" && -f "$unit_temp" ]]; then
    rm -f -- "$unit_temp"
  fi
}

systemd_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//%/%%}"
  printf '"%s"' "$value"
}

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      [[ $# -ge 2 ]] || fail "--service requires a value"
      service_name="$2"
      shift 2
      ;;
    --health-url)
      [[ $# -ge 2 ]] || fail "--health-url requires a value"
      health_url="$2"
      shift 2
      ;;
    --no-health-check)
      check_health=0
      shift
      ;;
    --force)
      force=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

[[ ${EUID:-$(id -u)} -ne 0 ]] || \
  fail "run this script without sudo; it will request sudo only when required"
[[ "$service_name" =~ ^[A-Za-z0-9_.@-]+\.service$ ]] || \
  fail "invalid service name: $service_name"
case "$service_name" in
  your-service.service|your-service-name.service|the-real-unit-name.service)
    fail "--service must be a real unit name, not a documentation placeholder; omit --service to use benefit-hq.service"
    ;;
esac

for required_command in curl cut dirname getent id install journalctl mktemp node npm rm sleep sudo systemctl; do
  command -v "$required_command" >/dev/null 2>&1 || fail "missing required command: $required_command"
done

[[ -f "$repo_root/.env" ]] || fail ".env is missing from $repo_root"
[[ -f "$repo_root/.next/BUILD_ID" ]] || \
  fail "production build is missing; run ./scripts/deploy-release.sh --no-restart first"

service_user="$(id -un)"
service_group="$(id -gn)"
service_home="$(getent passwd "$service_user" | cut -d: -f6)"
node_path="$(command -v node)"
npm_path="$(command -v npm)"

[[ -n "$service_home" && -d "$service_home" ]] || fail "could not resolve the home directory for $service_user"
[[ -x "$node_path" ]] || fail "Node.js is not executable at $node_path"
[[ -x "$npm_path" ]] || fail "npm is not executable at $npm_path"

node_dir="$(dirname "$node_path")"
npm_dir="$(dirname "$npm_path")"
runtime_path="$node_dir"
if [[ "$npm_dir" != "$node_dir" ]]; then
  runtime_path="$runtime_path:$npm_dir"
fi
runtime_path="$runtime_path:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

unit_path="/etc/systemd/system/$service_name"
if sudo test -e "$unit_path" && [[ $force -eq 0 ]]; then
  fail "$unit_path already exists; inspect it first or rerun with --force"
fi

unit_temp="$(mktemp "${TMPDIR:-/tmp}/benefit-hq-service.XXXXXX")"
{
  printf '[Unit]\n'
  printf 'Description=Benefit HQ web application\n'
  printf 'Wants=network-online.target\n'
  printf 'After=network-online.target\n'
  printf '\n[Service]\n'
  printf 'Type=simple\n'
  printf 'User=%s\n' "$service_user"
  printf 'Group=%s\n' "$service_group"
  printf 'WorkingDirectory=%s\n' "$(systemd_quote "$repo_root")"
  printf 'Environment=%s\n' "$(systemd_quote "HOME=$service_home")"
  printf 'Environment=%s\n' "$(systemd_quote "NODE_ENV=production")"
  printf 'Environment=%s\n' "$(systemd_quote "PATH=$runtime_path")"
  printf 'ExecStart=%s start\n' "$(systemd_quote "$npm_path")"
  printf 'Restart=on-failure\n'
  printf 'RestartSec=5s\n'
  printf 'TimeoutStopSec=30s\n'
  printf 'KillSignal=SIGTERM\n'
  printf 'UMask=0077\n'
  printf 'NoNewPrivileges=true\n'
  printf 'PrivateTmp=true\n'
  printf '\n[Install]\n'
  printf 'WantedBy=multi-user.target\n'
} >"$unit_temp"

printf '\n==> Installing %s for user %s\n' "$service_name" "$service_user"
sudo install -o root -g root -m 0644 "$unit_temp" "$unit_path"
sudo systemctl daemon-reload

printf '\n==> Enabling and starting %s\n' "$service_name"
if ! sudo systemctl enable --now "$service_name"; then
  sudo systemctl --no-pager --full status "$service_name" >&2 || true
  sudo journalctl --no-pager -n 50 -u "$service_name" >&2 || true
  fail "$service_name could not be started"
fi

if ! sudo systemctl is-active --quiet "$service_name"; then
  sudo systemctl --no-pager --full status "$service_name" >&2 || true
  sudo journalctl --no-pager -n 50 -u "$service_name" >&2 || true
  fail "$service_name did not remain active"
fi

if [[ $check_health -eq 1 ]]; then
  printf '\n==> Waiting for %s\n' "$health_url"
  healthy=0
  for attempt in {1..15}; do
    if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null; then
      healthy=1
      break
    fi
    printf 'Health check attempt %s/15 failed; retrying in 2 seconds...\n' "$attempt"
    sleep 2
  done
  if [[ $healthy -ne 1 ]]; then
    sudo systemctl --no-pager --full status "$service_name" >&2 || true
    sudo journalctl --no-pager -n 50 -u "$service_name" >&2 || true
    fail "$service_name is active but $health_url did not become healthy"
  fi
fi

printf '\nBenefit HQ systemd service installed successfully.\n'
printf 'Unit:       %s\n' "$unit_path"
printf 'User:       %s\n' "$service_user"
printf 'Repository: %s\n' "$repo_root"
printf 'Health URL: %s\n' "$health_url"
printf '\nFuture releases can use: ./scripts/deploy-release.sh\n'
