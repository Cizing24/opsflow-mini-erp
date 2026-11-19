import { z } from "zod";
export const roles = [
  "ADMIN",
  "MANAGER",
  "ENGINEER",
  "BUYER",
  "WAREHOUSE",
] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  ADMIN: "系統管理員",
  MANAGER: "部門主管",
  ENGINEER: "工程師",
  BUYER: "採購人員",
  WAREHOUSE: "倉儲人員",
};
export const statusLabels: Record<string, string> = {
  ACTIVE: "進行中",
  PLANNED: "規劃中",
  COMPLETED: "已完工",
  SUBMITTED: "待審核",
  RETURNED: "已退回",
  REJECTED: "已拒絕",
  APPROVED: "已核准",
  ORDERED: "已轉採購",
  OPEN: "待收貨",
  PARTIAL: "部分收貨",
  RECEIVED: "已收齊",
  IN: "入庫",
  OUT: "專案領料",
};
const text = z.string().trim().min(1).max(120);
const id = z.number().int().positive();
const cents = z.number().int().min(0).max(1_000_000_000);
export const loginSchema = z
  .object({ email: z.email().max(120), password: z.string().min(8).max(128) })
  .strict();
export const projectSchema = z
  .object({
    name: text,
    budgetCents: cents,
    ownerId: id,
    memberIds: z.array(id).max(100),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).default("ACTIVE"),
  })
  .strict();
export const supplierSchema = z
  .object({
    name: text,
    contact: z.string().trim().max(120),
    leadDays: z.number().int().min(0).max(365),
  })
  .strict();
export const materialSchema = z
  .object({
    sku: text,
    name: text,
    unit: text,
    unitCostCents: cents,
    reorderPoint: z.number().int().min(0).max(1_000_000),
  })
  .strict();
export const requirementSchema = z
  .object({
    materialId: id,
    quantity: z.number().int().positive().max(1_000_000),
  })
  .strict();
export const requestSchema = z
  .object({
    projectId: id,
    title: text,
    lines: z
      .array(
        z
          .object({
            materialId: id,
            quantity: z.number().int().positive().max(100_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const approvalSchema = z
  .object({
    decision: z.enum(["APPROVED", "RETURNED", "REJECTED"]),
    comment: z.string().trim().min(1).max(500),
  })
  .strict();
export const orderSchema = z
  .object({ requestId: id, supplierId: id, expectedAt: z.iso.datetime() })
  .strict();
export const receiptSchema = z
  .object({
    warehouseId: id,
    lines: z
      .array(
        z
          .object({
            lineId: id,
            quantity: z.number().int().positive().max(100_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export const issueSchema = z
  .object({
    projectId: id,
    materialId: id,
    warehouseId: id,
    quantity: z.number().int().positive().max(100_000),
    note: z.string().trim().min(1).max(200),
  })
  .strict();
export const listSchema = z.object({
  q: z.string().max(100).default(""),
  status: z.string().max(30).default(""),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("desc"),
});
export type ProjectInput = z.infer<typeof projectSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
export type ReceiptInput = z.infer<typeof receiptSchema>;
export type IssueInput = z.infer<typeof issueSchema>;
export interface UserView {
  id: number;
  name: string;
  email: string;
  role: Role;
  departmentId: number;
}
export function money(cents: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
