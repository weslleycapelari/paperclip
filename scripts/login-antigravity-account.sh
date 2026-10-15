#!/usr/bin/env bash
set -euo pipefail

ACCOUNT_NUM="${1:-}"

if [[ -z "$ACCOUNT_NUM" || ! "$ACCOUNT_NUM" =~ ^[1-3]$ ]]; then
  echo "Uso: $0 <1|2|3>"
  echo "Exemplo: $0 2   (para autenticar a Conta #2 do Antigravity Pro)"
  exit 1
fi

PROFILE_DIR="$HOME/.paperclip/credentials/antigravity/account-$ACCOUNT_NUM"
mkdir -p "$PROFILE_DIR"

echo "=========================================================="
echo " Conectando Antigravity Pro - Conta #$ACCOUNT_NUM"
echo " Diretório de credenciais: $PROFILE_DIR"
echo "=========================================================="
echo ""
echo "Instruções:"
echo "1. Uma sessão interativa do agy será iniciada com o perfil da Conta #$ACCOUNT_NUM."
echo "2. Se não estiver autenticado, o agy exibirá o fluxo/link de login do Google."
echo "3. Faça login com a conta Google da Conta #$ACCOUNT_NUM."
echo "4. Quando terminar, digite /exit ou pressione Ctrl+C."
echo ""
HOME="$PROFILE_DIR" agy
