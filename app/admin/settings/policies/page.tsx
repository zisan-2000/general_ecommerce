import { getPolicyAccess } from "@/lib/policy-content-admin";
import PolicyManager from "@/components/Settings/PolicyManager";
import { getTranslations } from "next-intl/server";
import { getSiteSettingsForSeo } from "@/lib/seo";

export default async function PolicyManagementPage() {
  const { error } = await getPolicyAccess();
  if (error) {
    const t = await getTranslations("AdminPolicyManagement");
    return <div className="p-6 text-muted-foreground">{t("permissionRequired")}</div>;
  }
  const settings = await getSiteSettingsForSeo();
  return <PolicyManager timeZone={settings.timezone} />;
}
