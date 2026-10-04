import { getPolicyAccess } from "@/lib/policy-content-admin";
import PolicyManager from "@/components/Settings/PolicyManager";

export default async function PolicyManagementPage() {
  const { error } = await getPolicyAccess();
  if (error) return <div className="p-6 text-muted-foreground">You need settings management permission to manage policies.</div>;
  return <PolicyManager />;
}
