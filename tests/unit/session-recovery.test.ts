import { afterEach, it, expect, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api, useAuth } from "../../apps/web/src/api.js";
afterEach(() => vi.restoreAllMocks());
const loggedIn = (id: number) =>
  new Response(
    JSON.stringify({
      user: {
        id,
        name: "測試使用者",
        email: `user${id}@opsflow.test`,
        role: "ENGINEER",
        departmentId: 1,
      },
      csrf: `session-${id}`,
    }),
  );
const expired = () =>
  new Response(
    JSON.stringify({ error: { message: "登入已逾時，請重新登入" } }),
    { status: 401 },
  );
it("expired sessions return to login, while a stale 401 cannot clear a newer login", async () => {
  setActivePinia(createPinia());
  const auth = useAuth(),
    fetch = vi.spyOn(globalThis, "fetch");
  fetch.mockResolvedValueOnce(loggedIn(1));
  await auth.login("user1@opsflow.test", "unit-test-password");
  fetch.mockResolvedValueOnce(expired());
  await expect(api("/projects")).rejects.toThrow("登入已逾時");
  expect(auth.user).toBeNull();
  fetch.mockResolvedValueOnce(loggedIn(2));
  await auth.login("user2@opsflow.test", "unit-test-password");
  let finishOld: (response: Response) => void = () => {};
  fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  const oldRequest = api("/projects");
  fetch.mockResolvedValueOnce(loggedIn(3));
  await auth.login("user3@opsflow.test", "unit-test-password");
  finishOld(expired());
  await expect(oldRequest).rejects.toThrow("登入已逾時");
  expect(auth.user?.id).toBe(3);
});
