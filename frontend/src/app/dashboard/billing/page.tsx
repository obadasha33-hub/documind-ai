"use client";

import { CreditCard, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For personal projects and exploration",
    features: [
      "5 documents",
      "20 queries per day",
      "Gemini AI",
      "Community support",
    ],
    current: true,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For professionals and small teams",
    features: [
      "50 documents",
      "500 queries per day",
      "Priority AI (Gemini + Groq)",
      "Email support",
      "Advanced analytics",
    ],
    current: false,
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "/month",
    description: "For organizations with larger needs",
    features: [
      "Unlimited documents",
      "Unlimited queries",
      "All AI models",
      "Priority support",
      "Custom integrations",
      "Team management",
    ],
    current: false,
  },
];

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your subscription and view usage.
        </p>
      </div>

      {/* Usage meter — placeholder */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Documents</p>
          <p className="mt-1 text-2xl font-bold">0 / 5</p>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Queries Today
          </p>
          <p className="mt-1 text-2xl font-bold">0 / 20</p>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Current Plan
          </p>
          <p className="mt-1 text-2xl font-bold">Free</p>
          <p className="mt-2 text-xs text-muted-foreground">$0/month</p>
        </div>
      </div>

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "flex flex-col rounded-xl border bg-card p-6",
              plan.current
                ? "border-primary shadow-sm"
                : "border-border"
            )}
          >
            <div>
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-sm text-muted-foreground">
                {plan.period}
              </span>
            </div>
            <ul className="mt-4 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              disabled={plan.current}
              className={cn(
                "mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                plan.current
                  ? "bg-primary/10 text-primary"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {plan.current ? "Current Plan" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
