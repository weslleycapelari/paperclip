import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";

/* ---- Help text for (?) tooltips ---- */
export const help: Record<string, string> = {
  name: "Nome de exibição para este agente.",
  title: "Cargo ou título exibido no organograma.",
  role: "Papel organizacional. Determina a posição na hierarquia e capacidades.",
  reportsTo: "O agente ao qual este se reporta na hierarquia da organização.",
  capabilities: "Descreve o que este agente pode fazer. Exibido no organograma e usado para roteamento de tarefas.",
  adapterType: "Como este agente executa: CLI local (Antigravity/Claude/Codex/OpenCode), OpenClaw Gateway, processo gerado ou webhook HTTP genérico.",
  cwd: "Diretório de trabalho legado (obsoleto) para adaptadores locais. Use workspaces de projeto para novas configurações.",
  promptTemplate: "Enviado em cada heartbeat. Mantenha conciso e dinâmico. Use para contextualizar a tarefa atual, não para instruções estáticas extensas. Suporta {{ agent.id }}, {{ agent.name }}, {{ agent.role }} e outras variáveis de template.",
  model: "Substituir o modelo padrão utilizado pelo adaptador.",
  thinkingEffort: "Controla a profundidade de raciocínio do modelo. Os valores suportados variam por adaptador/modelo.",
  chrome: "Ativar a integração com o navegador Chrome passando a flag --chrome.",
  dangerouslySkipPermissions: "Executar sem supervisão humana, auto-aprovando prompts de permissão do adaptador quando suportado.",
  dangerouslyBypassSandbox: "Executar sem restrições de sandbox. Necessário para acesso direto ao sistema de arquivos e rede.",
  search: "Ativar a capacidade de busca na web durante as execuções.",
  fastMode: "Ativar modo rápido (Fast Mode). Consome créditos/tokens mais rapidamente.",
  workspaceStrategy: "Como o Paperclip deve provisionar o workspace de execução para este agente (project_primary para execução normal no cwd ou git_worktree para checkouts isolados por tarefa).",
  workspaceBaseRef: "Git ref base usado ao criar uma branch de worktree. Deixe em branco para usar a ref padrão ou HEAD.",
  workspaceBranchTemplate: "Template para nomeação de branches derivadas. Suporta {{issue.identifier}}, {{issue.title}}, {{agent.name}}, etc.",
  worktreeParentDir: "Diretório pai onde os worktrees derivados serão criados. Caminhos absolutos, com ~ ou relativos são suportados.",
  runtimeServicesJson: "Definições opcionais de serviços em tempo de execução no workspace (servidores de desenvolvimento, workers compartilhados, etc.).",
  maxTurnsPerRun: "Número máximo de turnos agênticos (chamadas de ferramentas) por execução de heartbeat.",
  command: "O comando a executar (ex: node, python).",
  localCommand: "Substituir o caminho para o comando CLI que o adaptador deve chamar (ex: /usr/local/bin/agy, claude, codex, opencode).",
  args: "Argumentos de linha de comando separados por vírgula.",
  extraArgs: "Argumentos extras de CLI para adaptadores locais, separados por vírgula.",
  envVars: "Variáveis de ambiente injetadas no processo do adaptador. Use valores diretos ou referências a secrets.",
  secretAccess:
    "Secrets que este agente pode acessar. Vinculações por variável de ambiente são injetadas no início; acessos via API são consultados sob demanda.",
  bootstrapPrompt: "Enviado apenas quando o Paperclip inicia uma sessão limpa. Use para instruções estáveis de configuração que não devem ser repetidas a cada heartbeat.",
  payloadTemplateJson: "JSON opcional mesclado no payload da requisição antes do Paperclip adicionar os campos padrões de workspace.",
  webhookUrl: "URL que recebe requisições POST quando o agente é acionado.",
  heartbeatInterval: "Executar este agente automaticamente em um timer periódico. Útil para verificar novos trabalhos periodicamente.",
  intervalSec: "Segundos entre invocações automáticas de heartbeat.",
  timeoutSec: "Segundos máximos que uma execução pode durar antes de ser interrompida. 0 significa sem timeout.",
  graceSec: "Segundos de espera após sinal de interrupção antes de forçar o encerramento do processo.",
  wakeOnDemand: "Permitir que este agente seja acordado por atribuições de tarefas, chamadas de API, ações na UI ou automações.",
  cooldownSec: "Segundos mínimos de intervalo entre execuções consecutivas de heartbeat.",
  maxConcurrentRuns: "Número máximo de execuções simultâneas de heartbeat para este agente.",
  maxTurnContinuationEnabled: "Enfileirar automaticamente continuações quando um adaptador parar por limite de turnos por execução.",
  maxTurnContinuationMaxAttempts: "Máximo de tentativas de continuação automática após parada por limite de turnos.",
  maxTurnContinuationDelaySec: "Segundos de espera antes de iniciar cada continuação automática.",
  budgetMonthlyCents: "Limite de gasto mensal em centavos de dólar. 0 significa sem limite.",
};

import { getAdapterLabels } from "../adapters/adapter-display-registry";

export const adapterLabels = typeof getAdapterLabels === "function" ? getAdapterLabels() : {};

export const roleLabels: Record<string, string> = {
  ...AGENT_ROLE_LABELS,
  ceo: "CEO",
  cto: "CTO",
  cmo: "CMO",
  cfo: "CFO",
  security: "Segurança",
  engineer: "Engenheiro",
  designer: "Designer",
  pm: "Gerente de Produto (PM)",
  qa: "Controle de Qualidade (QA)",
  devops: "DevOps",
  researcher: "Pesquisador",
  general: "Geral",
};

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; configSection?: import("../adapters/types").AdapterConfigSection }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleTestId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      {/* Gallery feedback r3: was a hand-rolled h-5 w-9 pill with a bg-green-600
          track — the app's second switch implementation. Converged on the one
          canonical ToggleSwitch (status-green on-state), DESIGN.md principle 1. */}
      <ToggleSwitch
        data-testid={toggleTestId}
        aria-label={label}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function AutoExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function DraftInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Auto-expanding textarea with draft state and blur-commit.
 */
export function DraftTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function DraftNumberInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type">) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * "Choose" button that opens a dialog explaining the user must manually
 * type the path due to browser security limitations.
 */
export function ChoosePathButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
        onClick={() => setOpen(true)}
      >
        Choose
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Specify path manually</DialogTitle>
            <DialogDescription>
              Browser security blocks apps from reading full local paths via a file picker.
              Copy the absolute path and paste it into the input.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section className="space-y-1.5">
              <p className="font-medium">macOS (Finder)</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Find the folder in Finder.</li>
                <li>Hold <kbd>Option</kbd> and right-click the folder.</li>
                <li>Click "Copy &lt;folder name&gt; as Pathname".</li>
                <li>Paste the result into the path input.</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                /Users/yourname/Documents/project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">Windows (File Explorer)</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Find the folder in File Explorer.</li>
                <li>Hold <kbd>Shift</kbd> and right-click the folder.</li>
                <li>Click "Copy as path".</li>
                <li>Paste the result into the path input.</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                C:\Users\yourname\Documents\project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">Terminal fallback (macOS/Linux)</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Run <code>cd /path/to/folder</code>.</li>
                <li>Run <code>pwd</code>.</li>
                <li>Copy the output and paste it into the path input.</li>
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div className="w-24 ml-auto">{children}</div>
    </div>
  );
}
