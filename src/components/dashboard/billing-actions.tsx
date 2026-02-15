"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BillingActionsProps {
  hasActiveSubscription: boolean;
}

async function requestBillingUrl(endpoint: string): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan: "standard" }),
  });

  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error || "Failed to start billing flow");
  }

  return data.url;
}

export function BillingActions({ hasActiveSubscription }: BillingActionsProps) {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckout = async () => {
    setError(null);
    setIsCheckoutLoading(true);
    try {
      const url = await requestBillingUrl("/api/billing/checkout");
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open checkout");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const openPortal = async () => {
    setError(null);
    setIsPortalLoading(true);
    try {
      const url = await requestBillingUrl("/api/billing/portal");
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setIsPortalLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="bg-cyan-600 hover:bg-cyan-500 text-white"
          onClick={openCheckout}
          disabled={isCheckoutLoading || isPortalLoading}
        >
          {isCheckoutLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Opening...
            </span>
          ) : hasActiveSubscription ? (
            "Update Subscription"
          ) : (
            "Start Subscription"
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-300 text-slate-700 hover:bg-slate-100"
          onClick={openPortal}
          disabled={isCheckoutLoading || isPortalLoading}
        >
          {isPortalLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Opening...
            </span>
          ) : (
            "Billing Portal"
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
