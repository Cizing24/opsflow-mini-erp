import type { Role } from "@opsflow/shared";
export interface Material {
  id: number;
  sku: string;
  name: string;
  unit: string;
  unitCostCents: number;
  reorderPoint: number;
  origin: string;
  sourceKey?: string;
}
export interface Supplier {
  id: number;
  name: string;
  contact: string;
  leadDays: number;
}
export interface Project {
  id: number;
  code: string;
  name: string;
  budgetCents: number;
  status: string;
  ownerId: number;
  members: { userId: number; user?: { name: string } }[];
  owner?: { name: string };
  requirements?: { material: Material; quantity: number }[];
  committedCents: number;
  actualCents: number;
  budgetUse?: number | null;
}
export interface Catalog {
  projects: Project[];
  materials: Material[];
  suppliers: Supplier[];
  warehouses: { id: number; name: string }[];
  users: { id: number; name: string; role: Role; departmentId: number }[];
}
export interface RequestRow {
  id: number;
  number: string;
  title: string;
  projectId: number;
  requesterId: number;
  project: { name: string };
  requester: { name: string; departmentId: number };
  status: string;
  submittedAt: string;
  lines: {
    id: number;
    materialId: number;
    material: Material;
    quantity: number;
    unitCostCents: number;
  }[];
  approvals: {
    id: number;
    actor: { name: string };
    decision: string;
    comment: string;
    createdAt: string;
  }[];
  order?: { id: number; number: string } | null;
}
export interface OrderRow {
  id: number;
  number: string;
  status: string;
  orderedAt: string;
  expectedAt: string;
  supplier: Supplier;
  request: {
    id: number;
    number: string;
    project: { id: number; name: string };
  };
  lines: {
    id: number;
    materialId: number;
    material: Material;
    quantity: number;
    receivedQty: number;
    unitCostCents: number;
  }[];
  receipts: {
    id: number;
    createdAt: string;
    warehouse: { name: string };
    actor: { name: string };
    lines: { quantity: number; orderLineId: number }[];
  }[];
}
export interface Stock {
  materialId: number;
  warehouseId: number;
  quantity: number;
  material: Material;
  warehouse: { name: string };
}
export interface Movement {
  id: number;
  material: Material;
  warehouse: { name: string };
  project?: { name: string };
  actor: { name: string };
  kind: string;
  quantity: number;
  unitCostCents: number;
  createdAt: string;
  note: string;
  origin: string;
}
export interface DashboardData {
  company: string;
  asOf: string;
  from: string;
  kpis: {
    averageApprovalHours: number | null;
    pendingApprovals: number;
    onTimeDeliveryRate: number | null;
    partialReceiptRate: number | null;
    overdueCents: number;
    actualCostCents: number;
    inventoryTurnover: null;
    inventoryTurnoverReason: string;
    anomalyCount: number;
  };
  projects: Project[];
  pendingRequests: {
    id: number;
    number: string;
    title: string;
    submittedAt: string;
  }[];
  pendingOrders: {
    id: number;
    number: string;
    supplier: string;
    status: string;
    expectedAt: string;
  }[];
  lowStock: {
    materialId: number;
    name: string;
    warehouse: string;
    quantity: number;
    reorderPoint: number;
  }[];
  budgetAlerts: Project[];
}
export interface ListResult<T> {
  total: number;
  items: T[];
  page: number;
  pageSize: number;
}
