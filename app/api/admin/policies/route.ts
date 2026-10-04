import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { policyContentSchema } from "@/lib/policy-content";
import { getPolicyAccess, policyApiError } from "@/lib/policy-content-admin";
import { logActivity } from "@/lib/activity-log";

export async function GET() {
  try {
    const { error } = await getPolicyAccess();
    if (error) return error;
    const records = await prisma.storePolicyContent.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json(records, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return policyApiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { access, error } = await getPolicyAccess();
    if (error) return error;
    const parsed = policyContentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { effectiveDate, ...data } = parsed.data;
    const record = await prisma.storePolicyContent.create({ data: { ...data, effectiveDate: effectiveDate ? new Date(effectiveDate) : null } });
    await logActivity({ action: "create", entity: "store_policy_content", entityId: record.id, access, request, after: record });
    revalidatePath(`/ecommerce/${record.kind}`);
    return NextResponse.json(record, { status: 201 });
  } catch (error) { return policyApiError(error); }
}
