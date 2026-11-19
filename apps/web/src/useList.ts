import { ref, shallowRef } from "vue";
import { api } from "./api";
import type { ListResult } from "./types";
export function useList<T>(path: string) {
  let version = 0;
  const items = shallowRef<T[]>([]),
    total = ref(0),
    page = ref(1),
    q = ref(""),
    status = ref(""),
    sort = ref("desc"),
    loading = ref(false),
    error = ref("");
  async function load(reset = false) {
    const current = ++version;
    if (reset) page.value = 1;
    loading.value = true;
    error.value = "";
    try {
      const data = await api<ListResult<T>>(
        `${path}?${new URLSearchParams({ q: q.value, status: status.value, sort: sort.value, page: String(page.value), pageSize: "10" })}`,
      );
      if (current === version) {
        items.value = data.items;
        total.value = data.total;
      }
    } catch (e) {
      if (current === version) error.value = (e as Error).message;
    } finally {
      if (current === version) loading.value = false;
    }
  }
  return { items, total, page, q, status, sort, loading, error, load };
}
