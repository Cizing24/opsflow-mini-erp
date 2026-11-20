import { it, expect } from "vitest";
// Simulation only: this deliberately faulty feature exists exclusively in the drill fixture.
it("SIMULATION: new cost calculation must preserve quantity multiplication", () =>
  expect(3 + 199).toBe(597));
