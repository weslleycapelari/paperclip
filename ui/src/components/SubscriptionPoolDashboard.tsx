import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Label } from "@/components/ui/label";
import { costsApi } from "@/api/costs";
import { Bot, RefreshCw, Shield, Sparkles, CheckCircle2, Clock, AlertTriangle, KeyRound, Terminal } from "lucide-react";

interface SubscriptionPoolDashboardProps {
  companyId: string;
}

export function SubscriptionPoolDashboard({ companyId }: SubscriptionPoolDashboardProps) {
  const queryClient = useQueryClient();
  const [thresholdInput, setThresholdInput] = useState<number | null>(null);
  const [showConnectHelp, setShowConnectHelp] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subscription-pool", companyId],
    queryFn: () => costsApi.getSubscriptionPool(companyId),
    enabled: Boolean(companyId),
    refetchInterval: 15_000,
  });

  const saveMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      costsApi.saveSubscriptionPool(companyId, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription-pool", companyId] });
      void queryClient.invalidateQueries({ queryKey: ["usage-quota-windows", companyId] });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando painel do pool de assinaturas...</p>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6 border-destructive/50">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">Não foi possível carregar os dados do pool de assinaturas.</p>
        </div>
      </Card>
    );
  }

  const { config, activeWorkerAccount, managementAccount, workerAccounts } = data;
  const currentThreshold = thresholdInput ?? config.rotationThresholdPct ?? 85;

  const handleSaveThreshold = () => {
    saveMutation.mutate({ rotationThresholdPct: currentThreshold });
  };

  const getStatusBadge = (status: string, isActive = false) => {
    if (isActive) {
      return (
        <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-mono text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Ativa (Em Uso)
        </Badge>
      );
    }
    switch (status) {
      case "standby":
        return (
          <Badge variant="outline" className="border-sky-500/50 bg-sky-500/10 text-sky-500 font-mono text-xs gap-1">
            <Clock className="h-3 w-3" />
            Reserva (Pronta)
          </Badge>
        );
      case "cooling_down":
        return (
          <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-500 font-mono text-xs gap-1">
            <Clock className="h-3 w-3" />
            Cooldown
          </Badge>
        );
      case "exhausted":
        return (
          <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive font-mono text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            Cota Atingida (85%+)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-mono text-xs">
            Pronta
          </Badge>
        );
    }
  };

  const getMeterColor = (pct: number) => {
    if (pct >= 85) return "bg-rose-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <Card className="border-border/60 bg-gradient-to-r from-background via-muted/20 to-background">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Gestão de Assinaturas & Rotação Inteligente</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Claude Pro dedicado para liderança (CEO/Tech Lead) e 3 contas Antigravity Pro em rotação contínua para tarefas de execução.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showConnectHelp ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowConnectHelp(!showConnectHelp)}
                className="gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Como Conectar Contas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar Status
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Regra de Rotação:</span>
              <span>Troca automática ao atingir {currentThreshold}% da janela de 5h ou 7d</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Conta Worker Ativa:</span>
              <span className="font-mono text-primary font-bold">{activeWorkerAccount}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instruções de Conexão das Contas */}
      {showConnectHelp && (
        <Card className="border-primary/50 bg-muted/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Como Conectar Suas 3 Contas do Antigravity Pro</CardTitle>
            </div>
            <CardDescription>
              Cada conta possui seu próprio perfil isolado de credenciais em <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">~/.paperclip/credentials/antigravity/account-X</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-border/60 rounded-lg p-3 bg-background/50 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  Conta #1 (Ativa)
                </div>
                <p className="text-xs text-muted-foreground">
                  Já sincronizada com o seu login atual do CLI Antigravity.
                </p>
                <code className="block font-mono text-[11px] bg-muted/80 p-1.5 rounded text-foreground">
                  Pronta para uso
                </code>
              </div>

              <div className="border border-border/60 rounded-lg p-3 bg-background/50 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                  <KeyRound className="h-4 w-4" />
                  Conta #2 (Login)
                </div>
                <p className="text-xs text-muted-foreground">
                  Execute no terminal WSL para logar a segunda conta Google:
                </p>
                <code className="block font-mono text-[11px] bg-muted/80 p-1.5 rounded text-foreground select-all">
                  ./scripts/login-antigravity-account.sh 2
                </code>
              </div>

              <div className="border border-border/60 rounded-lg p-3 bg-background/50 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                  <KeyRound className="h-4 w-4" />
                  Conta #3 (Login)
                </div>
                <p className="text-xs text-muted-foreground">
                  Execute no terminal WSL para logar a terceira conta Google:
                </p>
                <code className="block font-mono text-[11px] bg-muted/80 p-1.5 rounded text-foreground select-all">
                  ./scripts/login-antigravity-account.sh 3
                </code>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Assim que autenticadas, o Paperclip fará a rotação preventiva automática entre as 3 contas conforme o consumo da janela de 5 horas e semanal de 7 dias.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid: 1 Management Account (Claude Pro) + 3 Worker Accounts (Antigravity) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Management Account: Claude Pro */}
        <Card className="border-primary/40 bg-primary/5 flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold truncate leading-tight">Claude Pro</h4>
                  <p className="text-(length:--text-micro) text-muted-foreground uppercase tracking-wider mt-0.5">Liderança & Gestão</p>
                </div>
              </div>
              {getStatusBadge(managementAccount.status, true)}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium truncate">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">{managementAccount.email || "Conectada (Liderança)"}</span>
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-1 flex-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dedicado a tomadas de decisão, planejamento arquitetural e revisões executivas (CEO, Lead, PM).
            </p>

            {/* 5h session meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-mono text-muted-foreground">Sessão (5h)</span>
                <span className="font-medium tabular-nums">{managementAccount.sessionUsagePct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getMeterColor(managementAccount.sessionUsagePct)}`}
                  style={{ width: `${Math.min(100, managementAccount.sessionUsagePct)}%` }}
                />
              </div>
              {managementAccount.sessionResetsAt && (
                <p className="text-(length:--text-nano) text-muted-foreground font-mono">
                  Reseta: {new Date(managementAccount.sessionResetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>

            {/* 7d weekly meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-mono text-muted-foreground">Semanal (7d)</span>
                <span className="font-medium tabular-nums">{managementAccount.weeklyUsagePct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getMeterColor(managementAccount.weeklyUsagePct)}`}
                  style={{ width: `${Math.min(100, managementAccount.weeklyUsagePct)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3 Antigravity Pro Worker Accounts */}
        {workerAccounts.map((account: any, idx: number) => {
          const isActive = account.key === activeWorkerAccount;
          return (
            <Card
              key={account.key}
              className={`flex flex-col justify-between transition-all ${
                isActive
                  ? "border-emerald-500/50 shadow-sm shadow-emerald-500/5 bg-emerald-500/[0.02]"
                  : "border-border/70"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"
                    }`}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate leading-tight">{account.label}</h4>
                      <p className="text-(length:--text-micro) text-muted-foreground uppercase tracking-wider mt-0.5">Worker Slot #{idx + 1}</p>
                    </div>
                  </div>
                  {getStatusBadge(account.status, isActive)}
                </div>

                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-border/40 text-xs">
                  {account.isConnected ? (
                    <span className="flex items-center gap-1.5 text-emerald-500 font-medium truncate" title={account.email}>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="truncate">{account.email || "Conectada"}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Não conectada</span>
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-1 flex-1">
                <div className="text-xs text-muted-foreground">
                  <span>Consumo: </span>
                  <span className="font-mono font-medium text-foreground">{account.totalTokensFormatted}</span>
                </div>

                {/* 5h session meter */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground">Sessão (5h)</span>
                    <span className="font-medium tabular-nums">{account.sessionUsagePct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getMeterColor(account.sessionUsagePct)}`}
                      style={{ width: `${Math.min(100, account.sessionUsagePct)}%` }}
                    />
                  </div>
                  {account.sessionResetsAt && (
                    <p className="text-(length:--text-nano) text-muted-foreground font-mono">
                      Reseta: {new Date(account.sessionResetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>

                {/* 7d weekly meter */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground">Semanal (7d)</span>
                    <span className="font-medium tabular-nums">{account.weeklyUsagePct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getMeterColor(account.weeklyUsagePct)}`}
                      style={{ width: `${Math.min(100, account.weeklyUsagePct)}%` }}
                    />
                  </div>
                </div>

                {!isActive && account.isConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8 gap-1.5 mt-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ manualActiveAccount: account.key })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Definir como Ativa
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration & Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações de Rotação Automática</CardTitle>
          <CardDescription>
            Ajuste os parâmetros de contingência e limites de troca para manter as equipes operando 24/7 sem interrupções.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold">Limite de Rotação (%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="threshold"
                  type="number"
                  min={50}
                  max={99}
                  value={currentThreshold}
                  onChange={(e) => setThresholdInput(Number(e.target.value))}
                  className="w-28 font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={saveMutation.isPending || currentThreshold === config.rotationThresholdPct}
                  onClick={handleSaveThreshold}
                >
                  Salvar Limite
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando uma conta Antigravity atingir esta porcentagem na janela de 5 horas ou 7 dias, a próxima conta do pool assumirá automaticamente as tarefas.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Troca Automática em Caso de Rate Limit</Label>
                  <p className="text-xs text-muted-foreground">
                    Se a API retornar erro 429 ou cota esgotada, rotaciona imediatamente.
                  </p>
                </div>
                <ToggleSwitch
                  checked={config.autoRotateOnRateLimit}
                  onCheckedChange={(checked) => saveMutation.mutate({ autoRotateOnRateLimit: checked })}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>Fallback Cruzado (Liderança / Workers)</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite contingência mútua caso todo o pool de um tipo esteja esgotado.
                  </p>
                </div>
                <ToggleSwitch
                  checked={config.fallbackToOtherProvider}
                  onCheckedChange={(checked) => saveMutation.mutate({ fallbackToOtherProvider: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
