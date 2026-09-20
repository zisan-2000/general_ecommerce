"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/labeled-input";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type PaymentGateway = {
  id: number;
  paymentGatewayData?: any;
};

type Props = {
  paymentGateways: PaymentGateway[];
  selectedMethod: string;
  onMethodChange: (v: string) => void;

  transactionId: string;
  onTransactionIdChange: (v: string) => void;

  paymentScreenshotUrl: string | null;
  paymentScreenshotPreview: string | null;
  onScreenshotChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploadingScreenshot: boolean;

  onBack: () => void;
  onNext: () => void;
  total: number;
};

export default function PaymentMethodSelector({
  paymentGateways,
  selectedMethod,
  onMethodChange,
  transactionId,
  onTransactionIdChange,
  paymentScreenshotUrl,
  paymentScreenshotPreview,
  onScreenshotChange,
  isUploadingScreenshot,
  onBack,
  onNext,
  total,
}: Props) {
  const t = useTranslations("StorefrontCommerce.payment");
  const locale = useLocale();
  // 1) /api/payment থেকে আসা গেটওয়েগুলোকে UI-friendly list বানানো
  const apiMethods = (Array.isArray(paymentGateways) ? paymentGateways : [])
    .map((p) => {
      const pg = p?.paymentGatewayData || {};
      const type = String(pg?.type || "").toUpperCase(); // "SSLCOMMERZ" | "MANUAL"
      if (!type) return null;

      // ইউনিক key বানাই, যাতে একাধিক manual channel আলাদা হয়
      const key =
        type === "MANUAL"
          ? `MANUAL:${String(pg?.channel || "Manual")}:${p.id}`
          : `${type}:${p.id}`;

      const title =
        type === "SSLCOMMERZ"
          ? "SSLCOMMERZ"
          : type === "MANUAL"
            ? String(pg?.channel || t("manualPayment"))
            : type;

      return {
        key,
        type,
        title,
        raw: p,
        pg,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    type: string;
    title: string;
    raw: PaymentGateway;
    pg: any;
  }>;

  // 2) চাইলে Cash On Delivery সবসময় দেখাতে পারো (API-তে না থাকলেও)
  const methods = [
    { key: "CashOnDelivery", type: "COD", title: t("cashOnDelivery"), pg: null as any },
    ...apiMethods,
  ];

  const isCOD = selectedMethod === "CashOnDelivery";
  const isSSL = selectedMethod?.startsWith("SSLCOMMERZ:");
  const isManual = selectedMethod?.startsWith("MANUAL:");

  const selectedManual = methods.find((m) => m.key === selectedMethod);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">{t("title")}</h2>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("back")}
        </Button>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("totalPayable")}: <span className="font-semibold text-foreground">৳{total.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </p>

        {/* ✅ সব মেথড দেখাবে */}
        <div className="grid gap-3">
          {methods.map((m) => (
            <label
              key={m.key}
              className={[
                "flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer",
                selectedMethod === m.key ? "border-primary ring-2 ring-primary/20" : "border-border",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground">{m.title}</div>

                {/* SSL info */}
                {m.type === "SSLCOMMERZ" && (
                  <div className="text-xs text-muted-foreground">
                    {t("sslDescription")}
                  </div>
                )}

                {/* Manual info */}
                {m.type === "MANUAL" && (
                  <div className="text-xs text-muted-foreground">
                    {t("manualDescription")}
                  </div>
                )}

                {/* COD info */}
                {m.key === "CashOnDelivery" && (
                  <div className="text-xs text-muted-foreground">{t("codDescription")}</div>
                )}
              </div>

              <input
                type="radio"
                name="payment_method"
                className="h-4 w-4"
                checked={selectedMethod === m.key}
                onChange={() => onMethodChange(m.key)}
              />
            </label>
          ))}
        </div>
      </div>

      {/* ✅ Manual payment হলে extra fields দেখাবে */}
      {isManual && (
        <div className="rounded-xl border border-border p-4 space-y-4">
          <div className="text-sm text-muted-foreground">
            {t("selected")}: <span className="font-semibold text-foreground">{selectedManual?.title}</span>
          </div>

          {/* account numbers দেখাও (API থেকে) */}
          {Array.isArray(selectedManual?.pg?.accountNumbers) && (
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">{t("sendMoneyTo")}:</div>
              <ul className="list-disc pl-5">
                {selectedManual!.pg.accountNumbers.map((n: string) => (
                  <li key={n} className="text-foreground font-medium">{n}</li>
                ))}
              </ul>
            </div>
          )}

          <LabeledInput
            id="transactionId"
            label={t("transactionId")}
            placeholder={t("transactionPlaceholder")}
            value={transactionId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTransactionIdChange(e.target.value)}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("screenshot")}</label>
            <input type="file" accept="image/*" onChange={onScreenshotChange} />
            {isUploadingScreenshot && (
              <p className="text-xs text-muted-foreground">{t("uploading")}</p>
            )}

            {(paymentScreenshotUrl || paymentScreenshotPreview) && (
              <div className="relative w-40 h-40 border border-border rounded-xl overflow-hidden bg-background">
                <Image
                  src={paymentScreenshotUrl || paymentScreenshotPreview!}
                  alt={t("screenshotAlt")}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* SSL / COD হলে extra কিছু লাগবে না */}
      {(isSSL || isCOD) && (
        <div className="text-sm text-muted-foreground">
          {isSSL ? t("sslRedirect") : t("noPaymentNow")}
        </div>
      )}

      <Button className="w-full" onClick={onNext} disabled={!selectedMethod}>
        {t("placeOrder")}
      </Button>
    </div>
  );
}
