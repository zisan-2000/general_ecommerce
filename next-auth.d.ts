import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      roleNames?: string[];
      permissions?: string[];
      globalPermissions?: string[];
      warehouseIds?: number[];
      primaryWarehouseId?: number | null;
      defaultAdminRoute?: "/admin" | "/admin/warehouse";
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: string;
    roleNames?: string[];
    permissions?: string[];
    globalPermissions?: string[];
    warehouseIds?: number[];
    primaryWarehouseId?: number | null;
    defaultAdminRoute?: "/admin" | "/admin/warehouse";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    blocked?: boolean;
    role?: string;
    roleNames?: string[];
    permissions?: string[];
    globalPermissions?: string[];
    warehouseIds?: number[];
    primaryWarehouseId?: number | null;
    defaultAdminRoute?: "/admin" | "/admin/warehouse";
  }
}
