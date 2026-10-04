import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { getAccessContext } from "@/lib/rbac";

export async function getPolicyAccess() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(session?.user);
  const error = !access.isAuthenticated
    ? NextResponse.json({ error: "Authentication required" }, { status: 401 })
    : !access.hasGlobal("settings.manage")
      ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : null;
  return { access, error };
}

export function policyApiError(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }
  console.error("Policy management error", error);
  return NextResponse.json({ error: "Unable to save or load policy content" }, { status: 500 });
}
