"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type PdfExportButtonProps = {
  targetId: string;
  filename: string;
  label?: string;
  className?: string;
};

export function PdfExportButton({
  targetId,
  filename,
  label,
  className,
}: PdfExportButtonProps) {
  const t = useTranslations("CommonPdfExport");

  const resolvedLabel = label ?? t("exportPdf");

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const target = document.getElementById(targetId);
    if (!target) {
      toast.error(t("errors.contentNotFound"));
      return;
    }

    try {
      setExporting(true);
      const html2pdf = (await import("html2pdf.js")).default;

      const options = {
        margin: 10,
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" as const },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(options).from(target).save();
    } catch (error: any) {
      toast.error(error?.message || t("errors.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={exporting}
      className={className}
    >
      <Download className="mr-2 h-4 w-4" />
      {exporting ? t("exporting") : resolvedLabel}
    </Button>
  );
}
