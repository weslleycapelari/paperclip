import type { CostByAgent } from "@paperclipai/shared";
import { useTranslation } from "@/i18n";
import { Badge } from "./ui/badge";

/** Use this group's ledger counts, never the page-wide estimate count. */
export function CostEstimateLabel({
  eventCount,
  estimatedEventCount,
}: Partial<Pick<CostByAgent, "eventCount" | "estimatedEventCount">>) {
  const { t } = useTranslation();
  if (!estimatedEventCount) return null;
  const allEstimated = estimatedEventCount === eventCount;
  return (
    <Badge
      variant="outline"
      className="font-normal text-muted-foreground"
      title={t("costs.badges.estimatedTitle", "{{count}} estimated {{unit}}. Calculated from token usage and published rates; provider bills may differ.", {
        count: estimatedEventCount,
        unit: estimatedEventCount === 1 ? t("costs.badges.charge", "charge") : t("costs.badges.charges", "charges"),
      })}
    >
      {allEstimated ? t("costs.badges.estimated", "Estimated") : t("costs.badges.partiallyEstimated", "Partially estimated")}
    </Badge>
  );
}
