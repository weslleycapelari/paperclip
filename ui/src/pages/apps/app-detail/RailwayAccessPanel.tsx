import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ConfigureRailwaySsh, ConnectionGrantsResponse, RailwaySshSetup, ToolConnection } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RailwayAccessPanel({ connection, grants }: { connection: ToolConnection; grants?: ConnectionGrantsResponse }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = useId();
  const setup = connection.config?.railwaySsh as RailwaySshSetup | null | undefined;
  const owned = (grants?.grants ?? []).filter((grant) => grant.kind !== "user" || grant.subjectUserId === grants?.currentUserId);
  const eligible = owned.filter((grant) => grant.status === "active");
  const [selectedGrant, setSelectedGrant] = useState("");
  const [knownHosts, setKnownHosts] = useState(setup?.knownHosts ?? "");
  useEffect(() => { setKnownHosts(setup?.knownHosts ?? ""); }, [setup?.knownHosts]);
  const grantId = setup?.grantId ?? (selectedGrant || eligible[0]?.id);
  const canConfigure = grants?.capabilities.canConfigure && connection.status === "active" && eligible.some((grant) => grant.id === grantId);
  const canRemove = grants?.capabilities.canConfigure && owned.some((grant) => grant.id === setup?.grantId);
  const mutation = useMutation({
    mutationFn: (input: ConfigureRailwaySsh) => toolsApi.configureRailwaySsh(connection.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tools.connection(connection.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tools.connectionGrants(connection.id) });
    },
  });
  return <section className="space-y-4" aria-labelledby={`${id}-title`}>
    <div className="space-y-2">
      <h2 id={`${id}-title`} className="text-lg font-semibold">{t("access.railwayAccess.title", { defaultValue: "Railway operations" })}</h2>
      <p className="text-sm text-muted-foreground">
        {typeof connection.config?.railwayApiMessage === "string" ? connection.config?.railwayApiMessage : t("access.railwayAccess.defaultMessage", { defaultValue: "Refresh actions after connecting to check service, log, and deployment access." })}
      </p>
    </div>
    <div className="space-y-2">
      <h3 className="font-medium">{t("access.railwayAccess.containerAccess", { defaultValue: "Container access" })}</h3>
      <p className="text-sm text-muted-foreground">
        {t("access.railwayAccess.containerAccessDesc", { defaultValue: "To allow Paperclip direct SSH access to Railway containers, you can optionally generate an SSH key pair." })}{" "}
        <a className="underline" href="https://docs.railway.com/cli/ssh" target="_blank" rel="noreferrer">
          {t("access.railwayAccess.sshDocs", { defaultValue: "Railway SSH documentation" })}
        </a>
      </p>
    </div>
    {!canConfigure && <p className="text-sm text-muted-foreground">{t("access.railwayAccess.managerNotice", { defaultValue: "The connection manager and authorization owner can configure container access." })}</p>}
    {(canConfigure || canRemove) && grantId && <>
      {!setup && eligible.length > 1 && <div className="space-y-2">
        <Label htmlFor={`${id}-grant`}>{t("access.railwayAccess.authorization", { defaultValue: "Authorization" })}</Label>
        <select id={`${id}-grant`} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={grantId} onChange={(event) => setSelectedGrant(event.target.value)}>
          {eligible.map((grant) => (
            <option key={grant.id} value={grant.id}>
              {grant.kind === "organization"
                ? t("access.railwayAccess.sharedAccount", { defaultValue: "Shared account" })
                : grant.kind === "user"
                  ? t("access.railwayAccess.myAccount", { defaultValue: "My account" })
                  : t("access.railwayAccess.agentAccount", { defaultValue: "Agent account" })}
            </option>
          ))}
        </select>
      </div>}
      {!setup && <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "prepare", grantId })}>{t("access.railwayAccess.generateKeyPair", { defaultValue: "Generate SSH key pair" })}</Button>}
      {setup && <>
        <div className="space-y-2">
          <Label htmlFor={`${id}-public`}>{t("access.railwayAccess.publicKey", { defaultValue: "Public key" })}</Label>
          <Textarea id={`${id}-public`} readOnly value={setup.publicKey} className="font-mono text-xs" />
          <p className="text-sm text-muted-foreground">
            {t("access.railwayAccess.publicKeyDesc", { defaultValue: "Register this public key in the Railway account used by this authorization. The private key stays in Paperclip’s vault." })}{" "}
            <a className="underline" href="https://docs.railway.com/cli/ssh#manage-ssh-keys" target="_blank" rel="noreferrer">
              {t("access.railwayAccess.keySetupLink", { defaultValue: "Railway key setup" })}
            </a>
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-host`}>{t("access.railwayAccess.verifiedHostKey", { defaultValue: "Verified Railway host key" })}</Label>
          <Textarea
            id={`${id}-host`}
            value={knownHosts}
            onChange={(event) => setKnownHosts(event.target.value)}
            placeholder={t("access.railwayAccess.verifiedHostKeyPlaceholder", { defaultValue: "ssh.railway.com ssh-ed25519 …" })}
            className="font-mono text-xs"
          />
          <p className="text-sm text-muted-foreground">{t("access.railwayAccess.verifiedHostKeyDesc", { defaultValue: "Paste the ssh.railway.com line from a known_hosts entry you have independently verified. Paperclip refuses untrusted or changed host keys." })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canConfigure || mutation.isPending || !knownHosts.trim()} onClick={() => mutation.mutate({ action: "enable", grantId, knownHosts })}>
            {setup.enabled ? t("access.railwayAccess.updateTrustedHostKey", { defaultValue: "Update trusted host key" }) : t("access.railwayAccess.enableContainerAccess", { defaultValue: "Enable container access" })}
          </Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "remove", grantId })}>
            {t("access.railwayAccess.removeContainerKey", { defaultValue: "Remove container key" })}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {setup.enabled ? t("access.railwayAccess.accessEnabledNotice", { defaultValue: "Container access is enabled for this authorization." }) : t("access.railwayAccess.registerBeforeEnablingNotice", { defaultValue: "Register the public key and verify the host key before enabling access." })}{" "}
          {t("access.railwayAccess.removingKeyStopsNotice", { defaultValue: "Removing the key stops new Paperclip connections. Also remove its public key from Railway." })}
        </p>
      </>}
    </>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : t("access.railwayAccess.updateFailed", { defaultValue: "Container access could not be updated." })}</p>}
  </section>;
}
