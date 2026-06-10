#!/usr/bin/env bash
# Resilient wrapper for update-site-data.py
# Retries on transient failures (gateway blips, network hiccups).
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
MAX_RETRIES=3
RETRY_DELAY=30  # seconds between retries
LOG_FILE="${REPO_DIR}/logs/update-site-data.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR"

for attempt in $(seq 1 "$MAX_RETRIES"); do
    log "Attempt $attempt/$MAX_RETRIES: running update-site-data.py"

    if python3 scripts/update-site-data.py 2>>"$LOG_FILE"; then
        log "SUCCESS on attempt $attempt/$MAX_RETRIES"
        echo "update-site-data: completed successfully (attempt $attempt/$MAX_RETRIES)"
        exit 0
    fi

    exit_code=$?
    log "Attempt $attempt/$MAX_RETRIES failed with exit code $exit_code"

    if [ "$attempt" -lt "$MAX_RETRIES" ]; then
        log "Retrying in ${RETRY_DELAY}s..."
        sleep "$RETRY_DELAY"
    fi
done

log "FAILED after $MAX_RETRIES attempts"
echo "update-site-data: FAILED after $MAX_RETRIES attempts"
exit 1
