import { isBillingEnabled } from "@/lib/env";

export function BillingSection() {
  if (!isBillingEnabled()) return null;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="border p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Free</h2>
        <p className="text-4xl font-bold mb-4">$0<span className="text-lg font-normal text-muted-foreground">/forever</span></p>
        <ul className="space-y-2 text-muted-foreground">
          <li>Full search & verdict</li>
          <li>3 active alerts</li>
          <li>25 MCP calls/day</li>
        </ul>
      </div>
      <div className="border p-6 rounded-lg bg-primary/5">
        <h2 className="text-2xl font-bold mb-4">Pro</h2>
        <p className="text-4xl font-bold mb-4">$49<span className="text-lg font-normal text-muted-foreground">/yr</span></p>
        <p className="text-sm text-muted-foreground mb-4 font-medium">Early price — grandfathered for life</p>
        <ul className="space-y-2">
          <li>Unlimited alerts</li>
          <li>1,000 MCP calls/day</li>
          <li>Weekly best-redemption digest</li>
        </ul>
      </div>
    </div>
  );
}
