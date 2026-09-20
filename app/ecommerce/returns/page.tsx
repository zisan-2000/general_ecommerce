import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function ReturnsPolicyPage() {
  const t = await getTranslations("StorefrontSupport.returns");
  const eligible = ["wrongProduct", "defect", "damaged", "missingParts"] as const;
  const ineligible = ["customerDamage", "modified", "late", "packaging"] as const;
  const steps = ["contact", "approval", "send", "refund"] as const;
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-r from-primary to-primary/80">
        <div className="container mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-background/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="h-8 w-8 text-primary-foreground" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            {t("title")}
          </h1>

          <p className="text-lg text-primary-foreground/90">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Quick Overview */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border">
              <Clock className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">
                {t("overview.windowTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("overview.windowDescription")}
              </p>
            </div>

            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border">
              <Package className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">
                {t("overview.conditionTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("overview.conditionDescription")}
              </p>
            </div>

            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border">
              <RefreshCw className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">
                {t("overview.processingTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("overview.processingDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Policy Details */}
      <section className="py-12 bg-card">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Eligible for Return */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
                {t("eligible.title")}
              </h2>

              <div className="space-y-4">
                {eligible.map((item) => (
                  <div key={item} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground">{t(`eligible.${item}`)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Not Eligible for Return */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
                <XCircle className="h-6 w-6 text-destructive mr-3" />
                {t("ineligible.title")}
              </h2>

              <div className="space-y-4">
                {ineligible.map((item) => (
                  <div key={item} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-destructive rounded-full mt-2 flex-shrink-0" />
                    <p className="text-muted-foreground">{t(`ineligible.${item}`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            {t("process.title")}
          </h2>

          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                  {index + 1}
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t(`process.${step}Title`)}
                </h3>
                <p className="text-sm text-muted-foreground">{t(`process.${step}Description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Refund Information */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {t("refund.title")}
          </h2>

          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="space-y-4 text-muted-foreground">
              <p>
                <strong className="text-foreground">{t("refund.timeLabel")}:</strong>{" "}
                {t("refund.timeValue")}
              </p>
              <p>
                <strong className="text-foreground">{t("refund.methodLabel")}:</strong>{" "}
                {t("refund.methodValue")}
              </p>
              <p>
                <strong className="text-foreground">{t("refund.shippingLabel")}:</strong>{" "}
                {t("refund.shippingValue")}
              </p>
              <p>
                <strong className="text-foreground">{t("refund.exchangeLabel")}:</strong>{" "}
                {t("refund.exchangeValue")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-12 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-2xl font-bold mb-4">
            {t("cta.title")}
          </h2>
          <p className="mb-6 opacity-90">
            {t("cta.description")}
          </p>

          <div className="flex justify-center">
            <Button asChild className="bg-background text-foreground hover:bg-background/90">
              <Link href="/ecommerce/contact">
                <Headphones className="h-4 w-4 mr-2" />
                {t("cta.action")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
