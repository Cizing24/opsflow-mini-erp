import { describe, it, expect } from "vitest";
import { requestSchema, receiptSchema, issueSchema } from "@opsflow/shared";
import { amount, uniqueLines } from "../../apps/api/src/transactions.js";
import { hashPassword, verifyPassword } from "../../apps/api/src/security.js";
describe("trust boundary and money", () => {
  it("rejects fractional and negative quantities", () => {
    expect(
      issueSchema.safeParse({
        projectId: 1,
        materialId: 1,
        warehouseId: 1,
        quantity: -1,
        note: "x",
      }).success,
    ).toBe(false);
    expect(
      receiptSchema.safeParse({
        warehouseId: 1,
        lines: [{ lineId: 1, quantity: 0.5 }],
      }).success,
    ).toBe(false);
  });
  it("rejects unknown privilege fields", () =>
    expect(
      requestSchema.safeParse({
        projectId: 1,
        title: "x",
        lines: [{ materialId: 1, quantity: 1 }],
        status: "APPROVED",
      }).success,
    ).toBe(false));
  it("rejects duplicate material lines", () =>
    expect(() => uniqueLines([1, 1])).toThrow());
  it("calculates integer cents and bounds totals", () => {
    expect(amount([{ quantity: 3, unitCostCents: 199 }])).toBe(597);
    expect(() =>
      amount([{ quantity: 100000, unitCostCents: 1000000 }]),
    ).toThrow();
  });
  it("hashes with salt and rejects wrong passwords", async () => {
    const a = await hashPassword("safe-local-password");
    const b = await hashPassword("safe-local-password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("safe-local-password", a)).toBe(true);
    expect(await verifyPassword("wrong-password", a)).toBe(false);
  });
});
