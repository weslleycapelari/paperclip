import { configFieldsForSection } from "../config-sections";
import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  Field,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Caminho absoluto para o arquivo de instruções em markdown (ex: AGENTS.md). Injetado no prompt do Antigravity em tempo de execução.";
const accountProfileHint =
  "Identificador do perfil/conta para o pool de rotação (ex: account-1, account-2, account-3). Isolamento de cotas de 5h/7d.";

export function AntigravityLocalConfigFields({
  section,
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  hideInstructionsFile,
}: AdapterConfigFieldsProps) {
  return configFieldsForSection(section, (
    <>
      {!hideInstructionsFile && (
        <Field label="Arquivo de instruções do agente" hint={instructionsFileHint}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={
                isCreate
                  ? values!.instructionsFilePath ?? ""
                  : eff(
                      "adapterConfig",
                      "instructionsFilePath",
                      String(config.instructionsFilePath ?? ""),
                    )
              }
              onCommit={(v) =>
                isCreate
                  ? set!({ instructionsFilePath: v })
                  : mark("adapterConfig", "instructionsFilePath", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/caminho/absoluto/para/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}

      <Field label="Perfil / Conta do Pool" hint={accountProfileHint}>
        <DraftInput
          value={
            isCreate
              ? (values as unknown as Record<string, unknown>)?.accountProfile as string ?? ""
              : eff(
                  "adapterConfig",
                  "accountProfile",
                  String(config.accountProfile ?? ""),
                )
          }
          onCommit={(v) =>
            isCreate
              ? (set as unknown as (patch: Record<string, unknown>) => void)!({ accountProfile: v })
              : mark("adapterConfig", "accountProfile", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="account-1"
        />
      </Field>
    </>
  ));
}
