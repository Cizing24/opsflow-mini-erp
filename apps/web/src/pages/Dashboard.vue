<script setup lang="ts">
import { ref, onMounted } from "vue";
import { money } from "@opsflow/shared";
import { Refresh, ArrowRight } from "@element-plus/icons-vue";
import { api, date, useAuth } from "../api";
import type { DashboardData } from "../types";
import StateTag from "../components/StateTag.vue";
const auth = useAuth(),
  data = ref<DashboardData>(),
  error = ref(""),
  loading = ref(false);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    data.value = await api<DashboardData>("/dashboard");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
const percent = (v: number | null) =>
  v === null ? "無資料" : `${(v * 100).toFixed(1)}%`;
onMounted(load);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>營運工作台</h1>
        <p>{{ auth.user?.name }}，從待辦掌握今天的工程營運。</p>
      </div>
      <el-button :loading="loading" @click="load">
        <el-icon><Refresh /></el-icon>
        更新資料
      </el-button>
    </div>
    <div v-if="error" class="error" role="alert">
      {{ error }}
      <button @click="load">重試</button>
    </div>
    <div v-if="loading && !data" class="loading" role="status">
      正在計算營運資料…
    </div>
    <template v-if="data">
      <div class="overview-strip">
        <div>
          <span>待審核案件</span>
          <strong>
            {{ data.kpis.pendingApprovals }}
            <small>件</small>
          </strong>
          <router-link to="/requests">
            前往請購與簽核
            <el-icon><ArrowRight /></el-icon>
          </router-link>
        </div>
        <div>
          <span>平均簽核時間 · 近 90 天</span>
          <strong>
            {{ data.kpis.averageApprovalHours?.toFixed(1) ?? "—" }}
            <small>小時</small>
          </strong>
          <p>僅計算已核准案件</p>
        </div>
        <div>
          <span>採購準時到貨率 · 近 90 天</span>
          <strong>{{ percent(data.kpis.onTimeDeliveryRate) }}</strong>
          <p>以完成收貨的採購單計算</p>
        </div>
        <div>
          <span>專案實際領用成本</span>
          <strong class="amount">{{ money(data.kpis.actualCostCents) }}</strong>
          <p>依庫存領料帳累計</p>
        </div>
      </div>
      <div v-if="data.kpis.anomalyCount" class="attention-banner">
        <div>
          <strong>有 {{ data.kpis.anomalyCount }} 項營運提醒需要留意</strong>
          <p>
            逾期待收 {{ money(data.kpis.overdueCents) }} · 低庫存
            {{ data.lowStock.length }} 項 · 預算警示
            {{ data.budgetAlerts.length }} 案
          </p>
        </div>
        <router-link to="/orders">檢視採購單 →</router-link>
      </div>
      <div class="dashboard-columns">
        <section class="panel">
          <div class="panel-heading">
            <h2>待辦與簽核</h2>
            <router-link to="/requests">查看全部 →</router-link>
          </div>
          <div v-if="!data.pendingRequests.length" class="empty">
            目前沒有待審核案件。
          </div>
          <router-link
            v-for="row in data.pendingRequests"
            :key="row.id"
            :to="`/requests?requestId=${row.id}`"
            class="task-row"
          >
            <span class="task-indicator"></span>
            <span>
              <strong>{{ row.title }}</strong>
              <small>{{ row.number }} · {{ date(row.submittedAt) }}</small>
            </span>
            <StateTag status="SUBMITTED" />
          </router-link>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <h2>待收貨採購</h2>
            <router-link to="/orders">查看全部 →</router-link>
          </div>
          <div v-if="!data.pendingOrders.length" class="empty">
            目前沒有待收貨採購單。
          </div>
          <router-link
            v-for="row in data.pendingOrders.slice(0, 5)"
            :key="row.id"
            :to="`/orders?orderId=${row.id}`"
            class="task-row"
          >
            <span>
              <strong>{{ row.number }}</strong>
              <small>
                {{ row.supplier }} · 預計 {{ date(row.expectedAt) }}
              </small>
            </span>
            <StateTag :status="row.status" />
          </router-link>
        </section>
      </div>
      <section class="panel project-overview">
        <div class="panel-heading">
          <div>
            <h2>專案預算與成本</h2>
            <p>預算承諾與實際領用分開追蹤，不重複加總。</p>
          </div>
          <router-link to="/projects">管理專案 →</router-link>
        </div>
        <el-table
          :data="data.projects.slice(0, 8)"
          row-key="id"
          empty-text="尚無專案"
        >
          <el-table-column label="工程專案" min-width="220">
            <template #default="{ row }">
              <strong>{{ row.name }}</strong>
              <small class="cell-sub">{{ row.code }}</small>
            </template>
          </el-table-column>
          <el-table-column label="狀態" width="100">
            <template #default="{ row }">
              <StateTag :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="專案預算" min-width="140" align="right">
            <template #default="{ row }">
              {{ money(row.budgetCents) }}
            </template>
          </el-table-column>
          <el-table-column label="已核准承諾" min-width="140" align="right">
            <template #default="{ row }">
              {{ money(row.committedCents) }}
            </template>
          </el-table-column>
          <el-table-column label="實際領用成本" min-width="140" align="right">
            <template #default="{ row }">
              {{ money(row.actualCents) }}
            </template>
          </el-table-column>
          <el-table-column label="預算承諾率" width="180">
            <template #default="{ row }">
              <div class="budget-meter">
                <span
                  :style="{
                    width: Math.min((row.budgetUse ?? 0) * 100, 100) + '%',
                  }"
                  :class="{ warn: row.budgetUse >= 0.8 }"
                ></span>
              </div>
              <small>{{ percent(row.budgetUse) }}</small>
            </template>
          </el-table-column>
        </el-table>
      </section>
      <div class="dashboard-columns">
        <section class="panel">
          <div class="panel-heading">
            <h2>庫存提醒</h2>
            <router-link to="/inventory">前往庫存 →</router-link>
          </div>
          <div v-if="!data.lowStock.length" class="empty">
            目前庫存皆高於安全量。
          </div>
          <div
            v-for="row in data.lowStock.slice(0, 4)"
            :key="row.materialId"
            class="task-row"
          >
            <span>
              <strong>{{ row.name }}</strong>
              <small>{{ row.warehouse }} · 安全量 {{ row.reorderPoint }}</small>
            </span>
            <span class="warning-text">剩餘 {{ row.quantity }}</span>
          </div>
        </section>
        <section class="panel metric-notes">
          <h2>營運計算口徑</h2>
          <dl>
            <div>
              <dt>部分收貨率（近 90 天採購）</dt>
              <dd>{{ percent(data.kpis.partialReceiptRate) }}</dd>
            </div>
            <div>
              <dt>資料更新時間</dt>
              <dd>{{ date(data.asOf) }}</dd>
            </div>
          </dl>
          <p>庫存周轉率：{{ data.kpis.inventoryTurnoverReason }}。</p>
          <p>此處呈現虛構企業的模擬數據。</p>
        </section>
      </div>
    </template>
  </section>
</template>
