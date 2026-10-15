#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Compilando interface (@paperclipai/ui)..."
pnpm --filter @paperclipai/ui build
PAPERCLIP_RELEASE_REUSE_UI_DIST=1 bash scripts/prepare-server-ui-dist.sh

echo "==> Reiniciando o processo do Paperclip (sem root)..."
paperclipai service restart

echo "==> Paperclip atualizado e rodando com sucesso em http://localhost:3200!"
