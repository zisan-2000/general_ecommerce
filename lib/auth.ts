// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getAccessContext } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { syncDeliveryManWarehouseAccess } from "@/lib/delivery-man-access";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db as never),
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: { email: {}, password: {} },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user?.passwordHash || user.banned) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        if (user.role === "delivery_man") {
          const deliveryProfile = await db.deliveryManProfile.findFirst({
            where: {
              userId: user.id,
            },
            select: {
              warehouseId: true,
            },
          });

          if (deliveryProfile?.warehouseId) {
            await syncDeliveryManWarehouseAccess(db, {
              userId: user.id,
              warehouseId: deliveryProfile.warehouseId,
              assignedById: null,
            });
          }
        }

        await logActivity({
          action: "login",
          entity: "profile",
          entityId: user.id,
          userId: user.id,
          metadata: {
            message: `Login successful for ${user.email}`,
          },
          after: {
            email: user.email,
            name: user.name ?? null,
            role: user.role ?? "user",
          },
        });

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role ?? "user",
        };
      },
    }),
  ],

  pages: {
    signIn: "/signin",
  },

  events: {
    async signOut(message) {
      const tokenUserId =
        typeof message.token?.id === "string" ? message.token.id : null;
      const tokenEmail =
        typeof message.token?.email === "string" ? message.token.email : null;

      await logActivity({
        action: "logout",
        entity: "profile",
        entityId: tokenUserId,
        userId: tokenUserId,
        metadata: {
          message: tokenEmail
            ? `Logout completed for ${tokenEmail}`
            : "Logout completed",
        },
      });
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "user";
        token.blocked = false;
      } else if (token.id) {
        const currentUser = await db.user.findUnique({
          where: { id: token.id },
          select: { banned: true },
        });
        token.blocked = !currentUser || currentUser.banned === true;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.blocked) {
        return { expires: session.expires } as typeof session;
      }
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        const access = await getAccessContext({
          id: typeof token.id === "string" ? token.id : undefined,
          role: typeof token.role === "string" ? token.role : undefined,
        });
        session.user.permissions = access.permissions;
        session.user.roleNames = access.roleNames;
        session.user.globalPermissions = access.globalPermissions;
        session.user.warehouseIds = access.warehouseIds;
        session.user.primaryWarehouseId = access.primaryWarehouseId;
        session.user.defaultAdminRoute = access.defaultAdminRoute;
      }
      return session;
    },
  },
};
