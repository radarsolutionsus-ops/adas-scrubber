import { auth } from "@/auth";
import { PremiumDashboard } from "@/components/dashboard/premium-dashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  return <PremiumDashboard />;
}
