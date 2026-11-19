<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { money } from "@opsflow/shared";
import { api, date, useAuth } from "../api";
import { useList } from "../useList";
import type { Catalog, Stock, Movement } from "../types";
import ListTools from "../components/ListTools.vue";
import StateTag from "../components/StateTag.vue";
const auth = useAuth(),
  stocks = useList<Stock>("/inventory"),
  movements = useList<Movement>("/movements"),
  tab = ref("stock"),
  catalog = ref<Catalog>(),
  drawer = ref(false),
  saving = ref(false),
  formError = ref("");
const projectId = ref(0),
  materialId = ref(0),
  warehouseId = ref(0),
  quantity = ref(1),
  note = ref(""),
  key = ref("");
function issue(row?: Stock) {
  projectId.value =
    catalog.value?.projects.find((p) => p.status === "ACTIVE")?.id ?? 0;
  materialId.value = row?.materialId ?? catalog.value?.materials[0]?.id ?? 0;
  warehouseId.value = row?.warehouseId ?? catalog.value?.warehouses[0]?.id ?? 0;
  quantity.value = 1;
  note.value = "";
  key.value = crypto.randomUUID();
  formError.value = "";
  drawer.value = true;
}
async function save() {
  saving.value = true;
  formError.value = "";
  try {
    const result = await api<{ costCents: number }>("/issues", {
      method: "POST",
      headers: { "Idempotency-Key": key.value },
      body: JSON.stringify({
        projectId: projectId.value,
        materialId: materialId.value,
        warehouseId: warehouseId.value,
        quantity: quantity.value,
        note: note.value,
      }),
    });
    drawer.value = false;
    ElMessage.success(`領料完成，專案成本增加 ${money(result.costCents)}`);
    await Promise.all([stocks.load(), movements.load()]);
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  try {
    catalog.value = await api<Catalog>("/catalog");
  } catch (e) {
    stocks.error.value = (e as Error).message;
  }
  await Promise.all([stocks.load(), movements.load()]);
});
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>庫存與領料</h1>
        <p>查詢可用庫存、追溯異動，將實際領用成本歸屬到專案。</p>
      </div>
      <el-button
        v-if="['ADMIN', 'ENGINEER'].includes(auth.user!.role)"
        type="primary"
        @click="issue()"
        >
專案領料
</el-button
      >
    </div>
    <div
      v-if="stocks.error.value || movements.error.value"
      class="error"
      role="alert"
    >
      {{ stocks.error.value || movements.error.value }}
    </div>
    <div class="panel">
      <el-tabs v-model="tab"
        >
<el-tab-pane label="庫存餘額" name="stock"
          >
<ListTools
            v-model:search="stocks.q.value"
            v-model:sort="stocks.sort.value"
            @search="stocks.load(true)" /><el-table
            v-loading="stocks.loading.value"
            :data="stocks.items.value"
            empty-text="沒有符合條件的庫存，收貨後將自動建立庫存餘額。"
            >
<el-table-column label="物料" min-width="220"
              >
<template #default="{ row }"
                >
<strong>{{ row.material.name }}</strong
                ><small class="cell-sub"
                  >{{ row.material.sku }} · {{ row.material.unit }}</small
                >
</template
              >
</el-table-column
            ><el-table-column
              prop="warehouse.name"
              label="倉庫"
              min-width="140"
            /><el-table-column label="可用數量" width="130" align="right"
              >
<template #default="{ row }"
                >
<strong
                  :class="{
                    'warning-text': row.quantity < row.material.reorderPoint,
                  }"
                  >{{ row.quantity }}</strong
                >
</template
              >
</el-table-column
            ><el-table-column
              prop="material.reorderPoint"
              label="安全量"
              width="100"
              align="right"
            /><el-table-column
              label="標準單位成本"
              min-width="140"
              align="right"
              >
<template #default="{ row }">
{{
                money(row.material.unitCostCents)
              }}
</template>
</el-table-column
            ><el-table-column label="庫存狀態" width="110"
              >
<template #default="{ row }"
                >
<el-tag
                  :type="
                    row.quantity < row.material.reorderPoint
                      ? 'warning'
                      : 'success'
                  "
                  size="small"
                  >
{{
                    row.quantity < row.material.reorderPoint
                      ? "低於安全量"
                      : "庫存正常"
                  }}
</el-tag
                >
</template
              >
</el-table-column
            ><el-table-column
              v-if="['ADMIN', 'ENGINEER'].includes(auth.user!.role)"
              label="操作"
              width="90"
              fixed="right"
              >
<template #default="{ row }"
                >
<el-button
                  link
                  type="primary"
                  :disabled="row.quantity === 0"
                  @click="issue(row)"
                  >
領料
</el-button
                >
</template
              >
</el-table-column
            >
</el-table
          >
          <div class="pagination">
            <span>共 {{ stocks.total.value }} 筆庫存</span
            ><el-pagination
              v-model:current-page="stocks.page.value"
              :total="stocks.total.value"
              :page-size="10"
              layout="prev,pager,next"
              @current-change="stocks.load()"
            />
</div>
</el-tab-pane
        ><el-tab-pane label="庫存異動紀錄" name="movements"
          >
<ListTools
            v-model:search="movements.q.value"
            v-model:sort="movements.sort.value"
            @search="movements.load(true)" /><el-table
            v-loading="movements.loading.value"
            :data="movements.items.value"
            empty-text="尚無庫存異動。"
            >
<el-table-column
              prop="id"
              label="異動編號"
              width="100" /><el-table-column label="時間" min-width="170"
              >
<template #default="{ row }">
{{
                date(row.createdAt)
              }}
</template>
</el-table-column
            ><el-table-column
              prop="material.name"
              label="物料"
              min-width="160" /><el-table-column label="類型" width="100"
              >
<template #default="{ row }"
                >
<StateTag :status="row.kind" />
</template>
</el-table-column
            ><el-table-column
              prop="quantity"
              label="數量"
              width="90" /><el-table-column
              prop="warehouse.name"
              label="倉庫"
              min-width="140" /><el-table-column
              prop="project.name"
              label="歸屬專案"
              min-width="180" /><el-table-column
              prop="note"
              label="異動說明"
              min-width="260" /><el-table-column
              prop="actor.name"
              label="執行人"
              width="100"
          />
</el-table>
          <div class="pagination">
            <span>共 {{ movements.total.value }} 筆異動</span
            ><el-pagination
              v-model:current-page="movements.page.value"
              :total="movements.total.value"
              :page-size="10"
              layout="prev,pager,next"
              @current-change="movements.load()"
            />
</div>
</el-tab-pane
      >
</el-tabs>
    </div>
    <el-drawer
      v-model="drawer"
      title="專案領料"
      size="min(560px,100vw)"
      destroy-on-close
      >
<div v-if="formError" class="error" role="alert">{{ formError }}</div>
      <form class="entity-form" @submit.prevent="save">
        <label for="issue-project">領用專案</label
        ><select id="issue-project" v-model.number="projectId" required>
          <option
            v-for="p in catalog?.projects.filter((p) => p.status === 'ACTIVE')"
            :key="p.id"
            :value="p.id"
          >
            {{ p.name }}
          </option>
</select
        ><label for="issue-material">領用物料</label
        ><select id="issue-material" v-model.number="materialId" required>
          <option v-for="m in catalog?.materials" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
</select
        ><label for="issue-warehouse">領料倉庫</label
        ><select id="issue-warehouse" v-model.number="warehouseId">
          <option v-for="w in catalog?.warehouses" :key="w.id" :value="w.id">
            {{ w.name }}
          </option>
</select
        ><label for="issue-quantity">領用數量</label
        ><input
          id="issue-quantity"
          v-model.number="quantity"
          type="number"
          min="1"
          max="100000"
          step="1"
          required
        /><label for="issue-note">領用用途</label
        ><textarea
          id="issue-note"
          v-model="note"
          rows="3"
          required
          maxlength="200"
          placeholder="請填寫施工位置與用途"
        ></textarea>
        <p class="muted">
          依物料標準成本計入專案。庫存不足時整筆交易會被拒絕。
        </p>
        <div class="form-actions">
          <el-button @click="drawer = false">取消</el-button
          ><el-button type="primary" native-type="submit" :loading="saving"
            >
確認領料
</el-button
          >
        </div>
      </form>
</el-drawer
    >
  </section>
</template>
