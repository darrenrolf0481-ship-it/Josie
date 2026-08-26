#!/usr/bin/env bash
# Start the full stack: DeepSeek Harness (workspace = Coming-home, ADHD-SAGE
# persona, OpenRouter LLM), LAN proxy, Coming-home SPA, and Josie MCP server.
# Safe to re-run; existing instances are reused.
set -u

LAN_IP="${DSH_LAN_IP:-10.115.10.253}"
HARNESS="/root/Josie/deepseek-harness/apps/cli/lib/bin.js"
PROFILE_PATCH="$HOME/.dsh/profiles/web/cordis.patch.yml"
REPO_PATCH="/root/Josie/dsh-profile/cordis.patch.yml"

already() { pgrep -f "$1" >/dev/null 2>&1; }

echo "── DeepSeek Harness (workspace: /root/Coming-home) ──"
# Ensure the OpenRouter provider patch is installed (idempotent).
if [ -f "$REPO_PATCH" ] && ! grep -q "openrouter" "$PROFILE_PATCH" 2>/dev/null; then
  mkdir -p "$(dirname "$PROFILE_PATCH")"
  cp "$REPO_PATCH" "$PROFILE_PATCH"
  echo "  installed openrouter profile patch"
fi

if already "[b]in.js --profile web"; then
  echo "  already running (pid $(pgrep -f '[b]in.js --profile web' | head -1))"
else
  cd /root/Coming-home
  # OpenRouter key for the harness LLM provider (stripped of surrounding quotes).
  ORKEY=$(grep -E "^OPENROUTER_API_KEY=" /root/ADHD-Sage/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r')
  ORKEY="${ORKEY%\"}"; ORKEY="${ORKEY#\"}"
  setsid nohup env OPENROUTER_API_KEY="$ORKEY" node "$HARNESS" \
    --profile web --no-open --port 3080 --host 127.0.0.1 \
    --trusted-host "${LAN_IP}:3080" > /tmp/dsh-web.log 2>&1 < /dev/null &
  echo "  launched with OpenRouter key (takes ~60s to boot)"
fi

echo "── LAN proxy ──"
if already "[d]sh-lan-proxy"; then
  echo "  already running (pid $(pgrep -f '[d]sh-lan-proxy' | head -1))"
else
  setsid nohup node /root/Josie/dsh-lan-proxy.mjs > /tmp/dsh-proxy.log 2>&1 < /dev/null &
  echo "  launched: ${LAN_IP}:3080 -> 127.0.0.1:3080"
fi

echo "── Coming-home (:3003) ──"
if already "[v]ite"; then
  echo "  already running"
else
  cd /root/Coming-home
  setsid nohup npm run dev > /tmp/ch-dev.log 2>&1 < /dev/null &
  echo "  launched"
fi

echo "── Josie (:3000) ──"
if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:3000"; then
  echo "  already running"
else
  cd /root/Josie
  setsid nohup npm run dev > /tmp/josie-dev.log 2>&1 < /dev/null &
  echo "  launched"
fi

echo
echo "Waiting for the harness to boot (up to 90s)..."
for i in $(seq 1 18); do
  if curl -s -o /dev/null --max-time 3 "http://127.0.0.1:3080"; then
    echo "✓ Harness up: http://127.0.0.1:3080  (${i}x5s)"
    break
  fi
  [ "$i" = 18 ] && echo "✗ Harness still booting — check /tmp/dsh-web.log"
  sleep 5
done

echo
check() { code=$(curl -s -o /dev/null -w "%{http_code}" "$2" --max-time 3 2>/dev/null || echo 000); echo "  $1  $2  -> $code"; }
check "harness        " "http://127.0.0.1:3080"
check "harness-LAN    " "http://${LAN_IP}:3080"
check "coming-home    " "http://127.0.0.1:3003"
check "josie          " "http://127.0.0.1:3000"
