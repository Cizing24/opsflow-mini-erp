<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { money } from "@opsflow/shared";
import { ElMessage } from "element-plus";
import { api, date, useAuth } from "../api";
import { useList } from "../useList";
import type { Catalog, OrderRow, RequestRow, ListResult } from "../types";
import ListTools from "../components/ListTools.vue";
import StateTag from "../components/StateTag.vue";
const auth = useAuth(),
  route = useRoute(),
  list = useList<OrderRow>("/orders"),
  { items, total, page, q, status, sort, loading, error } = list;
const catalog = ref<Catalog>(),
  approved = ref<RequestRow[]>([]),
  drawer = ref(false),
  creating = ref(false),
  selected = ref<OrderRow>(),
  saving = ref(false),
  formError = ref("");
const requestId = ref(0),
  supplierId = ref(0),
  expected = ref(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  ),
  warehouseId = ref(0),
  quantities = ref<Record<number, number>>({}),
  receiveKey = ref("");
function create() {
  creating.value = true;
  formError.value = "";
  requestId.value = approved.value[0]?.id ?? 0;
  supplierId.value = catalog.value?.suppliers[0]?.id ?? 0;
  drawer.value = true;
}
function view(row: OrderRow) {
  creating.value = false;
  selected.value = row;
  formError.value = "";
  warehouseId.value = catalog.value?.warehouses[0]?.id ?? 0;
  quantities.value = Object.fromEntries(row.lines.map((l) => [l.id, 0]));
  receiveKey.value = crypto.randomUUID();
  drawer.value = true;
}
async function refresh() {
  await list.load();
  approved.value = (
    await api<ListResult<RequestRow>>("/requests?status=APPROVED&pageSize=100")
  ).items;
}
async function save() {
  saving.value = true;
  formError.value = "";
  try {
    await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        requestId: requestId.value,
        supplierId: supplierId.value,
        expectedAt: new Date(`${expected.value}T16:00:00+08:00`).toISOString(),
      }),
    });
    drawer.value = false;
    ElMessage.success("採購單已建立");
    await refresh();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
async function receive() {
  saving.value = true;
  formError.value = "";
  const lines = selected
    .value!.lines.filter((l) => (quantities.value[l.id] ?? 0) > 0)
    .map((l) => ({ lineId: l.id, quantity: quantities.value[l.id] }));
  if (!lines.length) {
    formError.value = "請至少填寫一項收貨數量";
    saving.value = false;
    return;
  }
  try {
    await api(`/orders/${selected.value!.id}/receipts`, {
      method: "POST",
      headers: { "Idempotency-Key": receiveKey.value },
      body: JSON.stringify({ warehouseId: warehouseId.value, lines }),
    });
    drawer.value = false;
    ElMessage.success("收貨完成，庫存已更新");
    await refresh();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  try {
    catalog.value = await api<Catalog>("/catalog");
    await refresh();
    if (route.query.requestId) {
      create();
      requestId.value = Number(route.query.requestId);
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
});
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>採購與收貨</h1>
        <p>追蹤已核准需求、供應商交期與每一批實際到貨。</p>
      </div>
      <el-button
        v-if="['ADMIN', 'BUYER'].includes(auth.user!.role)"
        type="primary"
        @click="create"
        >
建立採購單
</el-button
      >
    </div>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div class="panel">
      <ListTools
        v-model:search="q"
        v-model:sort="sort"
        v-model:status="status"
        :statuses="{ OPEN: '待收貨', PARTIAL: '部分收貨', RECEIVED: '已收齊' }"
        @search="list.load(true)"
      /><el-table
        v-loading="loading"
        :data="items"
        row-key="id"
        empty-text="沒有符合條件的採購單。"
        >
<el-table-column label="採購單 / 專案" min-width="240"
          >
<template #default="{ row }"
            >
<strong>{{ row.number }}</strong
            ><small class="cell-sub">{{
              row.request.project.name
            }}</small>
</template
          >
</el-table-column
        ><el-table-column
          prop="supplier.name"
          label="供應商"
          min-width="180"
        /><el-table-column label="採購金額" min-width="130" align="right"
          >
<template #default="{ row }">
{{
            money(
              (row as OrderRow).lines.reduce(
                (s, l) => s + l.quantity * l.unitCostCents,
                0,
              ),
            )
          }}
</template>
</el-table-column
        ><el-table-column label="待收數量" width="100"
          >
<template #default="{ row }">
{{
            (row as OrderRow).lines.reduce(
              (s, l) => s + l.quantity - l.receivedQty,
              0,
            )
          }}
</template>
</el-table-column
        ><el-table-column label="預計到貨" min-width="160"
          >
<template #default="{ row }"
            >
<span
              :class="{
                'warning-text':
                  new Date(row.expectedAt) < new Date() &&
                  row.status !== 'RECEIVED',
              }"
              >{{ date(row.expectedAt) }}</span
            >
</template
          >
</el-table-column
        ><el-table-column label="狀態" width="110"
          >
<template #default="{ row }"
            >
<StateTag :status="row.status" />
</template>
</el-table-column
        ><el-table-column label="操作" fixed="right" width="110"
          >
<template #default="{ row }"
            >
<el-button type="primary" link @click="view(row)">
{{
              ["ADMIN", "WAREHOUSE"].includes(auth.user!.role) &&
              row.status !== "RECEIVED"
                ? "檢視與收貨"
                : "檢視單據"
            }}
</el-button>
</template
          >
</el-table-column
        >
</el-table
      >
      <div class="pagination">
        <span>共 {{ total }} 張採購單</span
        ><el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="10"
          layout="prev,pager,next"
          @current-change="list.load()"
        />
      </div>
    </div>
    <el-drawer
      v-model="drawer"
      :title="creating ? '建立採購單' : '採購單據追蹤'"
      size="min(720px,100vw)"
      destroy-on-close
      >
<div v-if="formError" class="error" role="alert">{{ formError }}</div>
      <form v-if="creating" class="entity-form" @submit.prevent="save">
        <p class="muted">採購單僅能由已核准且尚未採購的請購單建立。</p>
        <label for="order-request">已核准請購</label
        ><select id="order-request" v-model.number="requestId" required>
          <option :value="0" disabled>請選擇已核准的請購單</option>
          <option v-for="r in approved" :key="r.id" :value="r.id">
            {{ r.number }} · {{ r.title }}
          </option>
        </select>
        <p v-if="!approved.length" class="empty">
          目前沒有可建立採購的核准單，請先完成主管簽核。
        </p>
        <label for="order-supplier">供應商</label
        ><select id="order-supplier" v-model.number="supplierId" required>
          <option v-for="s in catalog?.suppliers" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
</select
        ><label for="order-expected">預計到貨日（台北時間 16:00）</label
        ><input id="order-expected" v-model="expected" type="date" required />
        <div class="form-actions">
          <el-button @click="drawer = false">取消</el-button
          ><el-button
            type="primary"
            native-type="submit"
            :loading="saving"
            :disabled="!requestId"
            >
確認建立採購單
</el-button
          >
        </div>
      </form>
      <template v-else-if="selected"
        >
<div class="document-heading">
          <h2>{{ selected.number }}</h2>
          <StateTag :status="selected.status" />
        </div>
        <dl class="details">
          <div>
            <dt>專案</dt>
            <dd>{{ selected.request.project.name }}</dd>
          </div>
          <div>
            <dt>供應商</dt>
            <dd>{{ selected.supplier.name }}</dd>
          </div>
          <div>
            <dt>來源請購</dt>
            <dd>{{ selected.request.number }}</dd>
          </div>
          <div>
            <dt>預計到貨</dt>
            <dd>{{ date(selected.expectedAt) }}</dd>
          </div>
        </dl>
        <el-table :data="selected.lines"
          >
<el-table-column
            prop="material.name"
            label="物料"
            min-width="160"
          /><el-table-column
            prop="quantity"
            label="採購"
            width="70"
          /><el-table-column
            prop="receivedQty"
            label="已收"
            width="70"
          /><el-table-column label="待收" width="70"
            >
<template #default="{ row }">
{{
              row.quantity - row.receivedQty
            }}
</template>
</el-table-column
          >
</el-table
        >
        <form
          v-if="
            ['ADMIN', 'WAREHOUSE'].includes(auth.user!.role) &&
            selected.status !== 'RECEIVED'
          "
          class="entity-form receipt-form"
          @submit.prevent="receive"
        >
          <h3>本次收貨</h3>
          <label for="receipt-warehouse">入庫倉庫</label
          ><select id="receipt-warehouse" v-model.number="warehouseId">
            <option v-for="w in catalog?.warehouses" :key="w.id" :value="w.id">
              {{ w.name }}
            </option>
</select
          ><template v-for="line in selected.lines" :key="line.id"
            >
<label :for="'receipt-' + line.id"
              >{{ line.material.name }} 本次收貨數量（待收
              {{ line.quantity - line.receivedQty }}）</label
            ><input
              :id="'receipt-' + line.id"
              v-model.number="quantities[line.id]"
              type="number"
              min="0"
              :max="line.quantity - line.receivedQty"
              step="1"
              required
          />
</template>
          <p class="muted">可部分收貨。確認後庫存帳與待收數量會一起更新。</p>
          <el-button type="primary" native-type="submit" :loading="saving"
            >
確認收貨入庫
</el-button
          >
        </form>
        <h3>收貨紀錄</h3>
        <p v-if="!selected.receipts.length" class="muted">尚未收貨。</p>
        <ol class="history">
          <li v-for="r in selected.receipts" :key="r.id">
            <strong>收貨 #{{ r.id }} · {{ r.warehouse.name }}</strong>
            <p>
              {{ r.actor.name }} · {{ date(r.createdAt) }} ·
              {{ r.lines.reduce((s, l) => s + l.quantity, 0) }} 件
            </p>
          </li>
        </ol>
</template
      >
</el-drawer
    >
  </section>
</template>
