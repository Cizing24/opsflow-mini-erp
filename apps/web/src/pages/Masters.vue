<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { money } from "@opsflow/shared";
import { api, useAuth } from "../api";
import type { Catalog, Supplier } from "../types";
const auth = useAuth(),
  catalog = ref<Catalog>(),
  error = ref(""),
  loading = ref(false),
  q = ref(""),
  tab = ref("suppliers"),
  drawer = ref(false),
  kind = ref("supplier"),
  saving = ref(false),
  formError = ref(""),
  selected = ref<Supplier>();
const name = ref(""),
  contact = ref(""),
  leadDays = ref(7),
  sku = ref(""),
  unit = ref("件"),
  cost = ref(0),
  reorderPoint = ref(10),
  csv = ref(""),
  quote = ref("");
const page = ref(1),
  sort = ref("asc");
const suppliers = computed(() =>
  [...(catalog.value?.suppliers ?? [])]
    .filter((s) => s.name.includes(q.value))
    .sort((a, b) => (sort.value === "asc" ? a.id - b.id : b.id - a.id)),
);
const materials = computed(() =>
  [...(catalog.value?.materials ?? [])]
    .filter((s) => s.name.includes(q.value) || s.sku.includes(q.value))
    .sort((a, b) => (sort.value === "asc" ? a.id - b.id : b.id - a.id)),
);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    catalog.value = await api<Catalog>("/catalog");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
function open(type: string, row?: Supplier) {
  kind.value = type;
  selected.value = row;
  name.value = row?.name ?? "";
  contact.value = row?.contact ?? "";
  leadDays.value = row?.leadDays ?? 7;
  sku.value = "";
  cost.value = 0;
  formError.value = "";
  csv.value = "sku,name,unit,unitCostCents,reorderPoint\n";
  drawer.value = true;
}
async function save() {
  saving.value = true;
  formError.value = "";
  try {
    const path =
      kind.value === "supplier"
        ? `/suppliers${selected.value ? "/" + selected.value.id : ""}`
        : kind.value === "csv"
          ? "/materials/import"
          : "/materials";
    const body =
      kind.value === "supplier"
        ? { name: name.value, contact: contact.value, leadDays: leadDays.value }
        : kind.value === "csv"
          ? { csv: csv.value }
          : {
              sku: sku.value,
              name: name.value,
              unit: unit.value,
              unitCostCents: Math.round(cost.value * 100),
              reorderPoint: reorderPoint.value,
            };
    await api(path, {
      method: selected.value ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    drawer.value = false;
    ElMessage.success("主檔資料已儲存");
    await load();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
async function supplierQuote(mode: string) {
  loading.value = true;
  quote.value = "";
  try {
    const result = await api<{
      reference: string;
      leadDays: number;
      attempts: number;
    }>(`/integrations/supplier-quote?mode=${mode}`);
    quote.value = `${result.reference}：模擬交期 ${result.leadDays} 天，請求 ${result.attempts} 次。`;
  } catch (e) {
    quote.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>供應商與物料</h1>
        <p>維護跨部門共用主檔，掌握資料來源與標準成本。</p>
      </div>
      <div class="heading-actions">
        <template
          v-if="
            tab === 'suppliers' && ['ADMIN', 'BUYER'].includes(auth.user!.role)
          "
        >
          <el-button type="primary" @click="open('supplier')">
            新增供應商
          </el-button>
        </template>
        <template
          v-if="
            tab === 'materials' &&
            ['ADMIN', 'WAREHOUSE'].includes(auth.user!.role)
          "
        >
          <el-button @click="open('csv')">CSV 匯入</el-button>
          <el-button type="primary" @click="open('material')">
            新增物料
          </el-button>
        </template>
      </div>
    </div>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div class="panel">
      <el-tabs
        v-model="tab"
        @tab-change="
          page = 1;
          q = '';
        "
      >
        <el-tab-pane label="供應商" name="suppliers" />
        <el-tab-pane label="物料主檔" name="materials" />
        <el-tab-pane
          v-if="['ADMIN', 'BUYER'].includes(auth.user!.role)"
          label="供應商 API 測試"
          name="integration"
        />
      </el-tabs>
      <div v-if="tab !== 'integration'" class="list-tools">
        <input
          v-model="q"
          aria-label="搜尋主檔"
          placeholder="搜尋名稱或 SKU…"
          type="search"
          @input="page = 1"
        />
        <select v-model="sort" aria-label="主檔排序">
          <option value="asc">最早在前</option>
          <option value="desc">最新在前</option>
        </select>
        <a
          v-if="
            tab === 'materials' &&
            ['ADMIN', 'BUYER', 'WAREHOUSE'].includes(auth.user!.role)
          "
          class="download-link"
          href="/api/materials/export"
        >
          匯出 CSV
        </a>
      </div>
      <el-table
        v-if="tab === 'suppliers'"
        v-loading="loading"
        :data="suppliers.slice((page - 1) * 10, page * 10)"
        empty-text="沒有符合條件的供應商。"
      >
        <el-table-column prop="name" label="供應商名稱" min-width="220" />
        <el-table-column
          prop="contact"
          label="聯絡資訊（虛構）"
          min-width="220"
        />
        <el-table-column label="標準交期" width="130">
          <template #default="{ row }">{{ row.leadDays }} 天</template>
        </el-table-column>
        <el-table-column
          v-if="['ADMIN', 'BUYER'].includes(auth.user!.role)"
          label="操作"
          width="110"
        >
          <template #default="{ row }">
            <el-button type="primary" link @click="open('supplier', row)">
              修改供應商
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-table
        v-if="tab === 'materials'"
        v-loading="loading"
        :data="materials.slice((page - 1) * 10, page * 10)"
        empty-text="沒有符合條件的物料。"
      >
        <el-table-column prop="sku" label="SKU" min-width="150" />
        <el-table-column prop="name" label="物料名稱" min-width="250" />
        <el-table-column prop="unit" label="單位" width="80" />
        <el-table-column label="標準單位成本" min-width="140" align="right">
          <template #default="{ row }">
            {{ money(row.unitCostCents) }}
          </template>
        </el-table-column>
        <el-table-column prop="reorderPoint" label="安全量" width="100" />
        <el-table-column label="資料來源" min-width="160">
          <template #default="{ row }">
            {{
              row.origin === "PUBLIC_DERIVED"
                ? "公開資料衍生"
                : row.origin === "TEST"
                  ? "系統測試"
                  : "合成企業資料"
            }}
            <small class="cell-sub">{{ row.sourceKey }}</small>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="tab !== 'integration'" class="pagination">
        <span>
          共
          {{ tab === "suppliers" ? suppliers.length : materials.length }}
          筆
        </span>
        <el-pagination
          v-model:current-page="page"
          :total="tab === 'suppliers' ? suppliers.length : materials.length"
          :page-size="10"
          layout="prev,pager,next"
        />
      </div>
      <div v-if="tab === 'integration'" class="integration-panel">
        <h2>隔離供應商模擬服務</h2>
        <p>查詢為唯讀 GET，timeout 為 600ms，最多安全重試兩次。</p>
        <div class="heading-actions">
          <el-button :loading="loading" @click="supplierQuote('success')">
            查詢模擬交期
          </el-button>
          <el-button :loading="loading" @click="supplierQuote('timeout')">
            模擬逾時
          </el-button>
          <el-button :loading="loading" @click="supplierQuote('error')">
            模擬服務錯誤
          </el-button>
        </div>
        <p v-if="quote" class="integration-result" role="status">{{ quote }}</p>
        <p class="muted">
          Simulation：這些操作只連接此專案的模擬服務，未連接真實供應商。
        </p>
      </div>
    </div>
    <el-drawer
      v-model="drawer"
      :title="
        kind === 'supplier'
          ? selected
            ? '修改供應商'
            : '新增供應商'
          : kind === 'csv'
            ? 'CSV 匯入物料'
            : '新增物料'
      "
      size="min(600px,100vw)"
      destroy-on-close
    >
      <div v-if="formError" class="error" role="alert">{{ formError }}</div>
      <form class="entity-form" @submit.prevent="save">
        <template v-if="kind === 'csv'">
          <label for="import-csv">CSV 內容（最多 500 列）</label>
          <textarea
            id="import-csv"
            v-model="csv"
            rows="12"
            required
            spellcheck="false"
          ></textarea>
          <p class="muted">
            欄位：sku,name,unit,unitCostCents,reorderPoint。成本使用整數分；任一列錯誤時整批不寫入。SKU
            必須尚未存在。
          </p>
        </template>
        <template v-else>
          <label for="master-name">
            {{ kind === "supplier" ? "供應商名稱" : "物料名稱" }}
          </label>
          <input id="master-name" v-model="name" required maxlength="120" />
          <template v-if="kind === 'supplier'">
            <label for="supplier-contact">聯絡資訊</label>
            <input id="supplier-contact" v-model="contact" maxlength="120" />
            <label for="supplier-lead">標準交期（天）</label>
            <input
              id="supplier-lead"
              v-model.number="leadDays"
              type="number"
              min="0"
              max="365"
              required
            />
          </template>
          <template v-else>
            <label for="material-sku">SKU</label>
            <input id="material-sku" v-model="sku" required maxlength="120" />
            <label for="material-unit">計量單位</label>
            <input id="material-unit" v-model="unit" required maxlength="120" />
            <label for="material-cost">標準單位成本（TWD）</label>
            <input
              id="material-cost"
              v-model.number="cost"
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              required
            />
            <label for="material-reorder">安全庫存量</label>
            <input
              id="material-reorder"
              v-model.number="reorderPoint"
              type="number"
              min="0"
              max="1000000"
              step="1"
              required
            />
          </template>
        </template>
        <div class="form-actions">
          <el-button @click="drawer = false">取消</el-button>
          <el-button type="primary" native-type="submit" :loading="saving">
            {{ kind === "csv" ? "驗證並匯入" : "儲存主檔" }}
          </el-button>
        </div>
      </form>
    </el-drawer>
  </section>
</template>
