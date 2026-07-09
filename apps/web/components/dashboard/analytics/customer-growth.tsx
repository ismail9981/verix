import { SectionCard } from "../home/section-card";
import { LineChart } from "./line-chart";
import { CUSTOMER_GROWTH } from "./mock-data";

export function CustomerGrowth() {
  const latest = CUSTOMER_GROWTH[CUSTOMER_GROWTH.length - 1]!;

  return (
    <SectionCard
      id="customer-growth"
      title="Customer growth"
      action={
        <span className="text-xs text-muted">
          {latest.value.toLocaleString()} total
        </span>
      }
    >
      <LineChart
        points={CUSTOMER_GROWTH}
        ariaLabel={`Customer growth reaching ${latest.value.toLocaleString()} customers.`}
      />
    </SectionCard>
  );
}
