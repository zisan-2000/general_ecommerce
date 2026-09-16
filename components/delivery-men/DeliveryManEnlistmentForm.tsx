"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Tesseract from "tesseract.js";
import { initialFormData, steps } from "./constants";
import {
  DeliveryManFormData,
  ParsedDocumentData,
  ReferencePerson,
} from "./types";
import { parseDocumentText } from "@/lib/document-parser";

type ErrorState = Record<string, string>;

type UploadedDocument = {
  type: string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  referenceIndex?: number;
};

type WarehouseOption = {
  id: number;
  name: string;
  code?: string;
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload/delivery-man-documents", {
    method: "POST",
    body: fd,
  });

  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Upload route did not return valid JSON");
  }

  const fileUrl =
    typeof data.fileUrl === "string"
      ? data.fileUrl
      : typeof data.url === "string"
        ? data.url
        : "";

  if (!res.ok || !data.success || !fileUrl) {
    throw new Error(data.error || data.message || "File upload failed");
  }

  return fileUrl;
}

async function uploadDeliveryManDocuments(params: {
  profilePhoto?: File | null;
  identityFrontFile?: File | null;
  identityBackFile?: File | null;
  fatherIdentityFrontFile?: File | null;
  fatherIdentityBackFile?: File | null;
  motherIdentityFrontFile?: File | null;
  motherIdentityBackFile?: File | null;
  bankChequeFile?: File | null;
  bondDocumentFile?: File | null;
  contractPaperFile?: File | null;
  signatureFile?: File | null;
  references?: Array<{
    identityFrontFile?: File | null;
    identityBackFile?: File | null;
  }>;
}): Promise<UploadedDocument[]> {
  const documents: UploadedDocument[] = [];

  async function pushFile(
    type: string,
    file?: File | null,
    extra?: Partial<UploadedDocument>,
  ) {
    if (!file) return;

    const fileUrl = await uploadFile(file);

    documents.push({
      type,
      fileUrl,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      ...extra,
    });
  }

  await pushFile("PROFILE_PHOTO", params.profilePhoto);

  await pushFile("IDENTITY_FRONT", params.identityFrontFile);
  await pushFile("IDENTITY_BACK", params.identityBackFile);

  await pushFile("FATHER_IDENTITY_FRONT", params.fatherIdentityFrontFile);
  await pushFile("FATHER_IDENTITY_BACK", params.fatherIdentityBackFile);

  await pushFile("MOTHER_IDENTITY_FRONT", params.motherIdentityFrontFile);
  await pushFile("MOTHER_IDENTITY_BACK", params.motherIdentityBackFile);

  await pushFile("BANK_CHEQUE", params.bankChequeFile);
  await pushFile("BOND", params.bondDocumentFile);
  await pushFile("CONTRACT_PAPER", params.contractPaperFile);

  if (params.references?.length) {
    for (let i = 0; i < params.references.length; i++) {
      const ref = params.references[i];

      await pushFile("REFERENCE_IDENTITY_FRONT", ref.identityFrontFile, {
        referenceIndex: i,
      });

      await pushFile("REFERENCE_IDENTITY_BACK", ref.identityBackFile, {
        referenceIndex: i,
      });
    }
  }

  return documents;
}

export default function DeliveryManEnlistmentForm() {
  const t = useTranslations("AdminDeliveryManEnlistmentForm");

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] =
    useState<DeliveryManFormData>(initialFormData);
  const [errors, setErrors] = useState<ErrorState>({});
  const [isReadingDoc, setIsReadingDoc] = useState(false);
  const [ocrMessage, setOcrMessage] = useState("");
  const [rawExtractedText, setRawExtractedText] = useState("");
  const [parsedDoc, setParsedDoc] = useState<ParsedDocumentData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);
  const [warehouseLoadError, setWarehouseLoadError] = useState("");

  const progress = useMemo(
    () => ((currentStep + 1) / steps.length) * 100,
    [currentStep],
  );

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        setIsLoadingWarehouses(true);
        setWarehouseLoadError("");

        const res = await fetch("/api/warehouses", {
          method: "GET",
          cache: "no-store",
        });

        const text = await res.text();

        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(t("errors.warehousesInvalidJson"));
        }

        if (!res.ok) {
          throw new Error(
            data.message || data.error || t("errors.warehousesLoadFailed"),
          );
        }

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.warehouses)
              ? data.warehouses
              : [];

        const normalized: WarehouseOption[] = list
          .map((item: any) => ({
            id: Number(item.id),
            name: String(item.name ?? ""),
            code: item.code ? String(item.code) : undefined,
          }))
          .filter((item: WarehouseOption) => item.id && item.name);

        setWarehouses(normalized);
      } catch (error) {
        console.error("WAREHOUSE LOAD ERROR:", error);
        setWarehouseLoadError(
          error instanceof Error
            ? error.message
            : t("errors.warehousesLoadFailed"),
        );
      } finally {
        setIsLoadingWarehouses(false);
      }
    };

    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedWarehouseLabel = useMemo(() => {
    const found = warehouses.find((w) => String(w.id) === formData.warehouse);
    if (!found) return formData.warehouse || "—";
    return found.code ? `${found.name} (${found.code})` : found.name;
  }, [warehouses, formData.warehouse]);

  const updateField = <K extends keyof DeliveryManFormData>(
    key: K,
    value: DeliveryManFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key as string]: "" }));
  };

  const updateReference = <K extends keyof ReferencePerson>(
    index: number,
    key: K,
    value: ReferencePerson[K],
  ) => {
    setFormData((prev) => {
      const next = [...prev.references];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, references: next };
    });
    setErrors((prev) => ({
      ...prev,
      [`references.${index}.${String(key)}`]: "",
    }));
  };

  const addReference = () => {
    setFormData((prev) => ({
      ...prev,
      references: [
        ...prev.references,
        {
          name: "",
          phone: "",
          relation: "",
          address: "",
          occupation: "",
          identityType: "NID",
          identityNumber: "",
          identityFrontFile: null,
          identityBackFile: null,
        },
      ],
    }));
  };

  const removeReference = (index: number) => {
    if (formData.references.length <= 2) return;
    setFormData((prev) => ({
      ...prev,
      references: prev.references.filter((_, i) => i !== index),
    }));
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    field: keyof DeliveryManFormData,
  ) => {
    const file = event.target.files?.[0] ?? null;
    updateField(field, file as DeliveryManFormData[keyof DeliveryManFormData]);
  };

  const handleReferenceFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    index: number,
    field: keyof ReferencePerson,
  ) => {
    const file = event.target.files?.[0] ?? null;
    updateReference(
      index,
      field,
      file as ReferencePerson[keyof ReferencePerson],
    );
  };

  const applyDetectedValues = (parsed: ParsedDocumentData) => {
    setFormData((prev) => ({
      ...prev,
      identityType:
        parsed.documentType === "PASSPORT"
          ? "PASSPORT"
          : parsed.documentType === "NID"
            ? "NID"
            : prev.identityType,
      fullName: parsed.fullName || prev.fullName,
      identityNumber: parsed.identityNumber || prev.identityNumber,
      dateOfBirth: parsed.dateOfBirth || prev.dateOfBirth,
      passportExpiryDate: parsed.passportExpiryDate || prev.passportExpiryDate,
    }));
  };

  const runClientOcr = async (file: File) => {
    setIsReadingDoc(true);
    setOcrMessage(t("ocr.reading"));
    setParsedDoc(null);
    setRawExtractedText("");

    try {
      const result = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (m.status) {
            setOcrMessage(
              `${m.status}${
                m.progress ? ` (${Math.round(m.progress * 100)}%)` : ""
              }`,
            );
          }
        },
      });

      const text = result.data.text || "";
      const parsed = parseDocumentText(text);

      setRawExtractedText(text);
      setParsedDoc(parsed);
      applyDetectedValues(parsed);
      setOcrMessage(t("ocr.complete"));
    } catch (error) {
      console.error(error);
      setOcrMessage(t("ocr.failed"));
    } finally {
      setIsReadingDoc(false);
    }
  };

  const handleOcrDocumentUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    updateField("identityFrontFile", file);
    await runClientOcr(file);
  };

  const validateStep = () => {
    const nextErrors: ErrorState = {};

    if (currentStep === 1) {
      if (!formData.fullName.trim())
        nextErrors.fullName = t("validation.fullNameRequired");
      if (!formData.mobileNumber.trim())
        nextErrors.mobileNumber = t("validation.mobileRequired");
      if (!formData.password.trim())
        nextErrors.password = t("validation.passwordRequired");
      if (!formData.dateOfBirth)
        nextErrors.dateOfBirth = t("validation.dateOfBirthRequired");
      if (!formData.gender) nextErrors.gender = t("validation.genderRequired");
      if (!formData.presentAddress.trim())
        nextErrors.presentAddress = t("validation.presentAddressRequired");
      if (!formData.permanentAddress.trim())
        nextErrors.permanentAddress = t("validation.permanentAddressRequired");
      if (!formData.emergencyContactName.trim())
        nextErrors.emergencyContactName = t("validation.emergencyNameRequired");
      if (!formData.emergencyContactNumber.trim())
        nextErrors.emergencyContactNumber = t(
          "validation.emergencyNumberRequired",
        );
      if (!formData.emergencyContactRelation.trim())
        nextErrors.emergencyContactRelation = t(
          "validation.emergencyRelationRequired",
        );
    }

    if (currentStep === 2) {
      if (!formData.identityNumber.trim())
        nextErrors.identityNumber = t("validation.identityNumberRequired");
      if (!formData.identityFrontFile)
        nextErrors.identityFrontFile = t("validation.identityFrontRequired");
      if (
        formData.identityType === "PASSPORT" &&
        !formData.passportExpiryDate
      ) {
        nextErrors.passportExpiryDate = t("validation.passportExpiryRequired");
      }
    }

    if (currentStep === 3) {
      if (!formData.fatherName.trim())
        nextErrors.fatherName = t("validation.fatherNameRequired");
      if (!formData.fatherIdentityNumber.trim())
        nextErrors.fatherIdentityNumber = t(
          "validation.fatherIdentityNumberRequired",
        );
      if (!formData.fatherIdentityFrontFile)
        nextErrors.fatherIdentityFrontFile = t(
          "validation.fatherIdentityFrontRequired",
        );
      if (!formData.motherName.trim())
        nextErrors.motherName = t("validation.motherNameRequired");
      if (!formData.motherIdentityNumber.trim())
        nextErrors.motherIdentityNumber = t(
          "validation.motherIdentityNumberRequired",
        );
      if (!formData.motherIdentityFrontFile)
        nextErrors.motherIdentityFrontFile = t(
          "validation.motherIdentityFrontRequired",
        );
    }

    if (currentStep === 4) {
      formData.references.forEach((ref, index) => {
        if (!ref.name.trim())
          nextErrors[`references.${index}.name`] = t(
            "validation.referenceNameRequired",
          );
        if (!ref.phone.trim())
          nextErrors[`references.${index}.phone`] = t(
            "validation.referencePhoneRequired",
          );
        if (!ref.relation.trim())
          nextErrors[`references.${index}.relation`] = t(
            "validation.referenceRelationRequired",
          );
        if (!ref.address.trim())
          nextErrors[`references.${index}.address`] = t(
            "validation.referenceAddressRequired",
          );
        if (!ref.identityNumber.trim())
          nextErrors[`references.${index}.identityNumber`] = t(
            "validation.referenceIdentityRequired",
          );
        if (!ref.identityFrontFile)
          nextErrors[`references.${index}.identityFrontFile`] = t(
            "validation.referenceIdentityFrontRequired",
          );
      });
    }

    if (currentStep === 5) {
      if (!formData.bankName.trim())
        nextErrors.bankName = t("validation.bankNameRequired");
      if (!formData.bankChequeFile)
        nextErrors.bankChequeFile = t("validation.bankChequeRequired");
      if (!formData.bondDocumentFile)
        nextErrors.bondDocumentFile = t("validation.bondDocumentRequired");
      if (!formData.contractPaperFile)
        nextErrors.contractPaperFile = t("validation.contractPaperRequired");
    }

    if (currentStep === 6) {
      if (!formData.warehouse)
        nextErrors.warehouse = t("validation.warehouseRequired");
      if (!formData.joiningDate)
        nextErrors.joiningDate = t("validation.joiningDateRequired");
      if (!formData.employmentType)
        nextErrors.employmentType = t("validation.employmentTypeRequired");
    }

    if (currentStep === 7) {
      if (!formData.declarationAccurate)
        nextErrors.declarationAccurate = t("validation.required");
      if (!formData.declarationVerification)
        nextErrors.declarationVerification = t("validation.required");
      if (!formData.declarationPolicy)
        nextErrors.declarationPolicy = t("validation.required");
      if (!formData.declarationDate)
        nextErrors.declarationDate = t("validation.declarationDateRequired");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (currentStep !== 0 && !validateStep()) return;
    if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const saveDraft = () => {
    localStorage.setItem(
      "delivery-man-enlistment-draft",
      JSON.stringify(formData),
    );
    alert(t("draft.saved"));
  };

  const loadDraft = () => {
    const raw = localStorage.getItem("delivery-man-enlistment-draft");
    if (!raw) return alert(t("draft.notFound"));
    try {
      const parsed = JSON.parse(raw) as DeliveryManFormData;
      setFormData({ ...initialFormData, ...parsed });
      alert(t("draft.loaded"));
    } catch {
      alert(t("draft.loadFailed"));
    }
  };

  const submit = async () => {
    if (!validateStep()) return;

    try {
      setIsSubmitting(true);

      const selectedWarehouseId = Number(formData.warehouse);
      if (!selectedWarehouseId) {
        throw new Error(t("errors.invalidWarehouse"));
      }

      const uploadedDocuments = await uploadDeliveryManDocuments({
        profilePhoto: formData.profilePhoto,
        identityFrontFile: formData.identityFrontFile,
        identityBackFile: formData.identityBackFile,
        fatherIdentityFrontFile: formData.fatherIdentityFrontFile,
        fatherIdentityBackFile: formData.fatherIdentityBackFile,
        motherIdentityFrontFile: formData.motherIdentityFrontFile,
        motherIdentityBackFile: formData.motherIdentityBackFile,
        bankChequeFile: formData.bankChequeFile,
        bondDocumentFile: formData.bondDocumentFile,
        contractPaperFile: formData.contractPaperFile,
        signatureFile: formData.signatureFile,
        references: formData.references,
      });

      const payload = {
        warehouseId: selectedWarehouseId,
        employeeCode: formData.employeeCode || "",

        fullName: formData.fullName,
        phone: formData.mobileNumber,
        alternatePhone: formData.alternateMobileNumber || "",
        email: formData.email || "",
        password: formData.password,
        dateOfBirth: formData.dateOfBirth || "",
        gender: formData.gender || "",

        presentAddress: formData.presentAddress,
        permanentAddress: formData.permanentAddress,

        emergencyContactName: formData.emergencyContactName || "",
        emergencyContactPhone: formData.emergencyContactNumber || "",
        emergencyContactRelation: formData.emergencyContactRelation || "",

        identityType: formData.identityType,
        identityNumber: formData.identityNumber,
        passportExpiryDate: formData.passportExpiryDate || "",

        fatherName: formData.fatherName,
        fatherIdentityType: formData.fatherIdentityType || "NID",
        fatherIdentityNumber: formData.fatherIdentityNumber || "",

        motherName: formData.motherName,
        motherIdentityType: formData.motherIdentityType || "NID",
        motherIdentityNumber: formData.motherIdentityNumber || "",

        bankName: formData.bankName || "",
        bankAccountName: formData.accountHolderName || "",
        bankAccountNumber: formData.accountNumber || "",
        bankChequeNumber: formData.chequeNumber || "",

        bondAmount: formData.bondAmount || "",
        bondSignedAt: formData.bondSignedDate || "",
        bondExpiryDate: formData.bondExpiryDate || "",

        contractSignedAt: formData.contractSignedDate || "",
        contractStartDate: formData.contractStartDate || "",
        contractEndDate: formData.contractEndDate || "",
        contractStatus: formData.contractStatus || "",

        joiningDate: formData.joiningDate,
        status: "PENDING",
        applicationStatus: "SUBMITTED",
        assignedById: null,
        note: formData.notes || "",

        references: formData.references.map((ref) => ({
          name: ref.name,
          phone: ref.phone,
          relation: ref.relation,
          address: ref.address,
          occupation: ref.occupation,
          identityType: ref.identityType,
          identityNumber: ref.identityNumber,
        })),

        documents: uploadedDocuments,
      };

      const res = await fetch("/api/delivery-men", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(t("errors.saveInvalidJson"));
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || t("errors.saveFailed"));
      }

      console.log("Saved successfully:", data);
      setSubmitted(true);
    } catch (error) {
      console.error("SUBMIT ERROR:", error);
      alert(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-card-foreground shadow-sm">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            ✓
          </div>
          <h2 className="rubik-bold text-2xl">{t("success.title")}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("success.description")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("progress.label")}</span>
            <span className="rubik-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const active = index === currentStep;
            const done = index < currentStep;
            return (
              <div
                key={step}
                className={`rounded-2xl border p-3 transition ${
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : done
                      ? "border-border bg-muted"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground border border-border"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </div>
                  <span className="rubik-medium text-sm">
                    {t(`steps.${index}`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        {currentStep === 0 && (
          <Section
            title={t("step0.title")}
            description={t("step0.description")}
          >
            <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-2xl border border-border bg-background p-5">
                <FileUpload
                  label={t("step0.uploadLabel")}
                  file={formData.identityFrontFile}
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleOcrDocumentUpload}
                />
                <div className="mt-4 rounded-2xl border border-border bg-muted p-4">
                  <p className="text-sm rubik-medium">{t("step0.ocrStatus")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isReadingDoc
                      ? ocrMessage
                      : ocrMessage || t("step0.noDocumentProcessed")}
                  </p>
                </div>
                {rawExtractedText ? (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium">
                      {t("step0.extractedTextPreview")}
                    </label>
                    <textarea
                      readOnly
                      value={rawExtractedText}
                      rows={10}
                      className="input-theme w-full rounded-2xl border bg-background px-4 py-3 text-xs outline-none"
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border bg-background p-5">
                <h3 className="rubik-semibold text-lg">
                  {t("step0.detectedInfo")}
                </h3>
                <div className="mt-4 space-y-3">
                  <InfoRow
                    label={t("step0.documentType")}
                    value={parsedDoc?.documentType || "—"}
                  />
                  <InfoRow
                    label={t("step0.fullName")}
                    value={parsedDoc?.fullName || "—"}
                  />
                  <InfoRow
                    label={t("step0.identityNumber")}
                    value={parsedDoc?.identityNumber || "—"}
                  />
                  <InfoRow
                    label={t("step0.dateOfBirth")}
                    value={parsedDoc?.dateOfBirth || "—"}
                  />
                  <InfoRow
                    label={t("step0.passportExpiry")}
                    value={parsedDoc?.passportExpiryDate || "—"}
                  />
                </div>

                {parsedDoc ? (
                  <button
                    type="button"
                    onClick={() => applyDetectedValues(parsedDoc)}
                    className="btn-primary mt-5 w-full rounded-xl px-4 py-3 text-sm font-medium"
                  >
                    {t("step0.useDetected")}
                  </button>
                ) : null}

                <p className="mt-4 text-xs text-muted-foreground">
                  {t("step0.disclaimer")}
                </p>
              </div>
            </div>
          </Section>
        )}

        {currentStep === 1 && (
          <Section
            title={t("step1.title")}
            description={t("step1.description")}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label={t("step1.fullName")}
                value={formData.fullName}
                onChange={(v) => updateField("fullName", v)}
                error={errors.fullName}
              />
              <Input
                label={t("step1.mobileNumber")}
                value={formData.mobileNumber}
                onChange={(v) => updateField("mobileNumber", v)}
                error={errors.mobileNumber}
              />
              <Input
                label={t("step1.email")}
                type="email"
                value={formData.email}
                onChange={(v) => updateField("email", v)}
              />
              <Input
                label={t("step1.password")}
                type="password"
                value={formData.password}
                onChange={(v) => updateField("password", v)}
                error={errors.password}
                placeholder={t("step1.passwordPlaceholder")}
              />
              <Input
                label={t("step1.dateOfBirth")}
                type="date"
                value={formData.dateOfBirth}
                onChange={(v) => updateField("dateOfBirth", v)}
                error={errors.dateOfBirth}
              />
              <Select
                label={t("step1.gender")}
                value={formData.gender}
                onChange={(v) =>
                  updateField("gender", v as DeliveryManFormData["gender"])
                }
                error={errors.gender}
                options={[
                  { label: t("step1.selectGender"), value: "" },
                  { label: t("step1.male"), value: "MALE" },
                  { label: t("step1.female"), value: "FEMALE" },
                  { label: t("step1.other"), value: "OTHER" },
                ]}
              />
              <Input
                label={t("step1.bloodGroup")}
                value={formData.bloodGroup}
                onChange={(v) => updateField("bloodGroup", v)}
              />
              <Input
                label={t("step1.maritalStatus")}
                value={formData.maritalStatus}
                onChange={(v) => updateField("maritalStatus", v)}
              />
            </div>

            <div className="mt-5">
              <FileUpload
                label={t("step1.profilePhoto")}
                file={formData.profilePhoto}
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => handleFileChange(e, "profilePhoto")}
              />
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Textarea
                label={t("step1.presentAddress")}
                value={formData.presentAddress}
                onChange={(v) => updateField("presentAddress", v)}
                error={errors.presentAddress}
              />
              <Textarea
                label={t("step1.permanentAddress")}
                value={formData.permanentAddress}
                onChange={(v) => updateField("permanentAddress", v)}
                error={errors.permanentAddress}
              />
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <Input
                label={t("step1.emergencyContactName")}
                value={formData.emergencyContactName}
                onChange={(v) => updateField("emergencyContactName", v)}
                error={errors.emergencyContactName}
              />
              <Input
                label={t("step1.emergencyContactNumber")}
                value={formData.emergencyContactNumber}
                onChange={(v) => updateField("emergencyContactNumber", v)}
                error={errors.emergencyContactNumber}
              />
              <Input
                label={t("step1.emergencyContactRelation")}
                value={formData.emergencyContactRelation}
                onChange={(v) => updateField("emergencyContactRelation", v)}
                error={errors.emergencyContactRelation}
              />
            </div>
          </Section>
        )}

        {currentStep === 2 && (
          <Section
            title={t("step2.title")}
            description={t("step2.description")}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Select
                label={t("step2.identityType")}
                value={formData.identityType}
                onChange={(v) =>
                  updateField(
                    "identityType",
                    v as DeliveryManFormData["identityType"],
                  )
                }
                options={[
                  { label: t("step2.nid"), value: "NID" },
                  { label: t("step2.passport"), value: "PASSPORT" },
                ]}
              />
              <Input
                label={t("step2.identityNumber")}
                value={formData.identityNumber}
                onChange={(v) => updateField("identityNumber", v)}
                error={errors.identityNumber}
              />
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <FileUpload
                label={t("step2.identityFront")}
                file={formData.identityFrontFile}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => handleFileChange(e, "identityFrontFile")}
                error={errors.identityFrontFile}
              />
              <FileUpload
                label={t("step2.identityBack")}
                file={formData.identityBackFile}
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => handleFileChange(e, "identityBackFile")}
              />
            </div>
            {formData.identityType === "PASSPORT" ? (
              <div className="mt-5 max-w-md">
                <Input
                  label={t("step2.passportExpiry")}
                  type="date"
                  value={formData.passportExpiryDate}
                  onChange={(v) => updateField("passportExpiryDate", v)}
                  error={errors.passportExpiryDate}
                />
              </div>
            ) : null}
          </Section>
        )}

        {currentStep === 3 && (
          <Section
            title={t("step3.title")}
            description={t("step3.description")}
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <Card title={t("step3.fatherTitle")}>
                <div className="grid gap-4">
                  <Input
                    label={t("step3.fatherName")}
                    value={formData.fatherName}
                    onChange={(v) => updateField("fatherName", v)}
                    error={errors.fatherName}
                  />
                  <Input
                    label={t("step3.fatherMobile")}
                    value={formData.fatherMobileNumber}
                    onChange={(v) => updateField("fatherMobileNumber", v)}
                  />
                  <Select
                    label={t("step3.fatherIdentityType")}
                    value={formData.fatherIdentityType}
                    onChange={(v) =>
                      updateField(
                        "fatherIdentityType",
                        v as DeliveryManFormData["fatherIdentityType"],
                      )
                    }
                    options={[
                      { label: t("step3.nid"), value: "NID" },
                      { label: t("step3.passport"), value: "PASSPORT" },
                    ]}
                  />
                  <Input
                    label={t("step3.fatherIdentityNumber")}
                    value={formData.fatherIdentityNumber}
                    onChange={(v) => updateField("fatherIdentityNumber", v)}
                    error={errors.fatherIdentityNumber}
                  />
                  <FileUpload
                    label={t("step3.fatherIdentityFront")}
                    file={formData.fatherIdentityFrontFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) =>
                      handleFileChange(e, "fatherIdentityFrontFile")
                    }
                    error={errors.fatherIdentityFrontFile}
                  />
                  <FileUpload
                    label={t("step3.fatherIdentityBack")}
                    file={formData.fatherIdentityBackFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) =>
                      handleFileChange(e, "fatherIdentityBackFile")
                    }
                  />
                </div>
              </Card>

              <Card title={t("step3.motherTitle")}>
                <div className="grid gap-4">
                  <Input
                    label={t("step3.motherName")}
                    value={formData.motherName}
                    onChange={(v) => updateField("motherName", v)}
                    error={errors.motherName}
                  />
                  <Input
                    label={t("step3.motherMobile")}
                    value={formData.motherMobileNumber}
                    onChange={(v) => updateField("motherMobileNumber", v)}
                  />
                  <Select
                    label={t("step3.motherIdentityType")}
                    value={formData.motherIdentityType}
                    onChange={(v) =>
                      updateField(
                        "motherIdentityType",
                        v as DeliveryManFormData["motherIdentityType"],
                      )
                    }
                    options={[
                      { label: t("step3.nid"), value: "NID" },
                      { label: t("step3.passport"), value: "PASSPORT" },
                    ]}
                  />
                  <Input
                    label={t("step3.motherIdentityNumber")}
                    value={formData.motherIdentityNumber}
                    onChange={(v) => updateField("motherIdentityNumber", v)}
                    error={errors.motherIdentityNumber}
                  />
                  <FileUpload
                    label={t("step3.motherIdentityFront")}
                    file={formData.motherIdentityFrontFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) =>
                      handleFileChange(e, "motherIdentityFrontFile")
                    }
                    error={errors.motherIdentityFrontFile}
                  />
                  <FileUpload
                    label={t("step3.motherIdentityBack")}
                    file={formData.motherIdentityBackFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) =>
                      handleFileChange(e, "motherIdentityBackFile")
                    }
                  />
                </div>
              </Card>
            </div>
          </Section>
        )}

        {currentStep === 4 && (
          <Section
            title={t("step4.title")}
            description={t("step4.description")}
            action={
              <button
                type="button"
                onClick={addReference}
                className="btn-outline rounded-xl px-4 py-2 text-sm font-medium"
              >
                {t("step4.addReference")}
              </button>
            }
          >
            <div className="space-y-6">
              {formData.references.map((reference, index) => (
                <Card
                  key={index}
                  title={t("step4.referenceTitle", { index: index + 1 })}
                  right={
                    formData.references.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => removeReference(index)}
                        className="text-sm font-medium text-destructive"
                      >
                        {t("step4.remove")}
                      </button>
                    ) : null
                  }
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Input
                      label={t("step4.fullName")}
                      value={reference.name}
                      onChange={(v) => updateReference(index, "name", v)}
                      error={errors[`references.${index}.name`]}
                    />
                    <Input
                      label={t("step4.mobileNumber")}
                      value={reference.phone}
                      onChange={(v) => updateReference(index, "phone", v)}
                      error={errors[`references.${index}.phone`]}
                    />
                    <Input
                      label={t("step4.relation")}
                      value={reference.relation}
                      onChange={(v) => updateReference(index, "relation", v)}
                      error={errors[`references.${index}.relation`]}
                    />
                    <Input
                      label={t("step4.occupation")}
                      value={reference.occupation}
                      onChange={(v) => updateReference(index, "occupation", v)}
                    />
                    <Textarea
                      label={t("step4.address")}
                      value={reference.address}
                      onChange={(v) => updateReference(index, "address", v)}
                      error={errors[`references.${index}.address`]}
                    />
                    <div className="grid gap-5">
                      <Select
                        label={t("step4.identityType")}
                        value={reference.identityType}
                        onChange={(v) =>
                          updateReference(
                            index,
                            "identityType",
                            v as ReferencePerson["identityType"],
                          )
                        }
                        options={[
                          { label: t("step4.nid"), value: "NID" },
                          { label: t("step4.passport"), value: "PASSPORT" },
                        ]}
                      />
                      <Input
                        label={t("step4.identityNumber")}
                        value={reference.identityNumber}
                        onChange={(v) =>
                          updateReference(index, "identityNumber", v)
                        }
                        error={errors[`references.${index}.identityNumber`]}
                      />
                    </div>
                  </div>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <FileUpload
                      label={t("step4.identityFront")}
                      file={reference.identityFrontFile}
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) =>
                        handleReferenceFileChange(e, index, "identityFrontFile")
                      }
                      error={errors[`references.${index}.identityFrontFile`]}
                    />
                    <FileUpload
                      label={t("step4.identityBack")}
                      file={reference.identityBackFile}
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) =>
                        handleReferenceFileChange(e, index, "identityBackFile")
                      }
                    />
                  </div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {currentStep === 5 && (
          <Section
            title={t("step5.title")}
            description={t("step5.description")}
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <Card title={t("step5.bankTitle")}>
                <div className="grid gap-4">
                  <Input
                    label={t("step5.bankName")}
                    value={formData.bankName}
                    onChange={(v) => updateField("bankName", v)}
                    error={errors.bankName}
                  />
                  <Input
                    label={t("step5.accountHolderName")}
                    value={formData.accountHolderName}
                    onChange={(v) => updateField("accountHolderName", v)}
                  />
                  <Input
                    label={t("step5.accountNumber")}
                    value={formData.accountNumber}
                    onChange={(v) => updateField("accountNumber", v)}
                  />
                  <Input
                    label={t("step5.chequeNumber")}
                    value={formData.chequeNumber}
                    onChange={(v) => updateField("chequeNumber", v)}
                  />
                  <FileUpload
                    label={t("step5.bankCheque")}
                    file={formData.bankChequeFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => handleFileChange(e, "bankChequeFile")}
                    error={errors.bankChequeFile}
                  />
                </div>
              </Card>
              <Card title={t("step5.bondTitle")}>
                <div className="grid gap-4">
                  <Input
                    label={t("step5.bondAmount")}
                    value={formData.bondAmount}
                    onChange={(v) => updateField("bondAmount", v)}
                  />
                  <Input
                    label={t("step5.bondSignedDate")}
                    type="date"
                    value={formData.bondSignedDate}
                    onChange={(v) => updateField("bondSignedDate", v)}
                  />
                  <Input
                    label={t("step5.bondExpiryDate")}
                    type="date"
                    value={formData.bondExpiryDate}
                    onChange={(v) => updateField("bondExpiryDate", v)}
                  />
                  <FileUpload
                    label={t("step5.bondDocument")}
                    file={formData.bondDocumentFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => handleFileChange(e, "bondDocumentFile")}
                    error={errors.bondDocumentFile}
                  />
                </div>
              </Card>
            </div>
            <div className="mt-6">
              <Card title={t("step5.contractTitle")}>
                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    label={t("step5.contractSignedDate")}
                    type="date"
                    value={formData.contractSignedDate}
                    onChange={(v) => updateField("contractSignedDate", v)}
                  />
                  <Input
                    label={t("step5.contractStartDate")}
                    type="date"
                    value={formData.contractStartDate}
                    onChange={(v) => updateField("contractStartDate", v)}
                  />
                  <Input
                    label={t("step5.contractEndDate")}
                    type="date"
                    value={formData.contractEndDate}
                    onChange={(v) => updateField("contractEndDate", v)}
                  />
                  <Input
                    label={t("step5.contractStatus")}
                    value={formData.contractStatus}
                    onChange={(v) => updateField("contractStatus", v)}
                  />
                </div>
                <div className="mt-5 max-w-xl">
                  <FileUpload
                    label={t("step5.contractPaper")}
                    file={formData.contractPaperFile}
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => handleFileChange(e, "contractPaperFile")}
                    error={errors.contractPaperFile}
                  />
                </div>
              </Card>
            </div>
          </Section>
        )}

        {currentStep === 6 && (
          <Section
            title={t("step6.title")}
            description={t("step6.description")}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Select
                label={t("step6.warehouse")}
                value={formData.warehouse}
                onChange={(v) => updateField("warehouse", v)}
                error={errors.warehouse}
                options={[
                  {
                    label: isLoadingWarehouses
                      ? t("step6.loadingWarehouses")
                      : t("step6.selectWarehouse"),
                    value: "",
                  },
                  ...warehouses.map((w) => ({
                    label: w.code ? `${w.name} (${w.code})` : w.name,
                    value: String(w.id),
                  })),
                ]}
              />
              <Input
                label={t("step6.employeeCode")}
                value={formData.employeeCode}
                onChange={(v) => updateField("employeeCode", v)}
              />
              <Input
                label={t("step6.joiningDate")}
                type="date"
                value={formData.joiningDate}
                onChange={(v) => updateField("joiningDate", v)}
                error={errors.joiningDate}
              />
              <Select
                label={t("step6.employmentType")}
                value={formData.employmentType}
                onChange={(v) =>
                  updateField(
                    "employmentType",
                    v as DeliveryManFormData["employmentType"],
                  )
                }
                error={errors.employmentType}
                options={[
                  { label: t("step6.selectEmploymentType"), value: "" },
                  { label: t("step6.fullTime"), value: "FULL_TIME" },
                  { label: t("step6.partTime"), value: "PART_TIME" },
                  { label: t("step6.contractual"), value: "CONTRACTUAL" },
                ]}
              />
              <Input
                label={t("step6.deliveryZone")}
                value={formData.deliveryZone}
                onChange={(v) => updateField("deliveryZone", v)}
              />
              <Input
                label={t("step6.assignedBy")}
                value={formData.assignedBy}
                onChange={(v) => updateField("assignedBy", v)}
              />
            </div>

            {warehouseLoadError ? (
              <p className="mt-3 text-sm text-destructive">
                {warehouseLoadError}
              </p>
            ) : null}

            <div className="mt-5">
              <Textarea
                label={t("step6.notes")}
                value={formData.notes}
                onChange={(v) => updateField("notes", v)}
              />
            </div>
          </Section>
        )}

        {currentStep === 7 && (
          <Section
            title={t("step7.title")}
            description={t("step7.description")}
          >
            <div className="rounded-2xl border border-border bg-background p-5">
              <h3 className="rubik-semibold text-lg">
                {t("step7.summaryTitle")}
              </h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoRow
                  label={t("step7.fullName")}
                  value={formData.fullName || "—"}
                />
                <InfoRow
                  label={t("step7.mobileNumber")}
                  value={formData.mobileNumber || "—"}
                />
                <InfoRow
                  label={t("step7.identityType")}
                  value={formData.identityType || "—"}
                />
                <InfoRow
                  label={t("step7.identityNumber")}
                  value={formData.identityNumber || "—"}
                />
                <InfoRow
                  label={t("step7.dateOfBirth")}
                  value={formData.dateOfBirth || "—"}
                />
                <InfoRow
                  label={t("step7.warehouse")}
                  value={selectedWarehouseLabel}
                />
                <InfoRow
                  label={t("step7.joiningDate")}
                  value={formData.joiningDate || "—"}
                />
                <InfoRow
                  label={t("step7.employmentType")}
                  value={formData.employmentType || "—"}
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background p-5">
              <h3 className="rubik-semibold text-lg">
                {t("step7.declarationTitle")}
              </h3>
              <div className="mt-4 space-y-3">
                <Checkbox
                  label={t("step7.declarationAccurate")}
                  checked={formData.declarationAccurate}
                  onChange={(checked) =>
                    updateField("declarationAccurate", checked)
                  }
                  error={errors.declarationAccurate}
                />
                <Checkbox
                  label={t("step7.declarationVerification")}
                  checked={formData.declarationVerification}
                  onChange={(checked) =>
                    updateField("declarationVerification", checked)
                  }
                  error={errors.declarationVerification}
                />
                <Checkbox
                  label={t("step7.declarationPolicy")}
                  checked={formData.declarationPolicy}
                  onChange={(checked) =>
                    updateField("declarationPolicy", checked)
                  }
                  error={errors.declarationPolicy}
                />
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Input
                  label={t("step7.declarationDate")}
                  type="date"
                  value={formData.declarationDate}
                  onChange={(v) => updateField("declarationDate", v)}
                  error={errors.declarationDate}
                />
              </div>
            </div>
          </Section>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 0 || isSubmitting}
            className="btn-outline rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("navigation.previous")}
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={isSubmitting}
              className="btn-primary rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("navigation.nextStep")}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={isSubmitting}
              className="btn-primary rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? t("navigation.submitting")
                : t("navigation.submitApplication")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="rubik-bold text-2xl">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="rubik-semibold text-lg">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm rubik-semibold">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm rubik-medium">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`input-theme w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring ${
          error ? "border-destructive" : ""
        }`}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm rubik-medium">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-theme w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring ${
          error ? "border-destructive" : ""
        }`}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm rubik-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-theme w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring ${
          error ? "border-destructive" : ""
        }`}
      >
        {options.map((option) => (
          <option key={`${option.label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FileUpload({
  label,
  file,
  onChange,
  accept,
  error,
}: {
  label: string;
  file: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  error?: string;
}) {
  const t = useTranslations("AdminDeliveryManEnlistmentForm");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  return (
    <div>
      <label className="mb-2 block text-sm rubik-medium">{label}</label>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          error
            ? "border-destructive bg-muted"
            : "border-border bg-muted hover:bg-accent"
        }`}
      >
        {previewUrl ? (
          <div className="mb-3 w-full">
            <img
              src={previewUrl}
              alt={t("fileUpload.previewAlt")}
              className="h-full w-full object-cover rounded-lg border border-border"
            />
          </div>
        ) : (
          <div className="mb-3 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-primary text-xl">📄</span>
          </div>
        )}
        <span className="text-sm rubik-medium">
          {file ? file.name : t("fileUpload.clickToUpload")}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          {t("fileUpload.supportedFormats")}
        </span>
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={onChange}
        />
      </label>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-border"
        />
        <span className="text-sm">{label}</span>
      </label>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
