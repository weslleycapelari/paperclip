import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { NewAgentSetup } from "../components/new-agent/NewAgentSetup";

export function NewAgent() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => {
    setBreadcrumbs([
      { label: t("agents.title"), href: "/agents" },
      { label: t("agents.newAgentSetup.title") },
    ]);
  }, [setBreadcrumbs, t]);
  return <NewAgentSetup />;
}
