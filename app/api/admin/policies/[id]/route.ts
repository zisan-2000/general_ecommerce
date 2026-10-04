import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { policyContentSchema } from "@/lib/policy-content";
import { getPolicyAccess, policyApiError } from "@/lib/policy-content-admin";
import { logActivity } from "@/lib/activity-log";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  try {
    const { access, error } = await getPolicyAccess();
    if (error) return error;
    const { id } = await context.params;
    const parsed = policyContentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { effectiveDate, ...data } = parsed.data;
    const before = await prisma.storePolicyContent.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Content not found" }, { status: 404 });
    const record = await prisma.storePolicyContent.update({ where: { id }, data: { ...data, effectiveDate: effectiveDate ? new Date(effectiveDate) : null } });
    await logActivity({ action: "update", entity: "store_policy_content", entityId: id, access, request, before, after: record });
    revalidatePath(`/ecommerce/${before.kind}`);
    revalidatePath(`/ecommerce/${record.kind}`);
    return NextResponse.json(record);
  } catch (error) { return policyApiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { access, error } = await getPolicyAccess();
    if (error) return error;
    const { id } = await context.params;
    const record = await prisma.storePolicyContent.delete({ where: { id } });
    await logActivity({ action: "delete", entity: "store_policy_content", entityId: id, access, request, before: record });
    revalidatePath(`/ecommerce/${record.kind}`);
    return NextResponse.json({ success: true });
  } catch (error) { return policyApiError(error); }
}
