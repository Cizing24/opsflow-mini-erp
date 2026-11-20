<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { money } from "@opsflow/shared";
import { ElMessage } from "element-plus";
import { api, date, useAuth } from "../api";
import { useList } from "../useList";
import type { Catalog, RequestRow } from "../types";
import ListTools from "../components/ListTools.vue";
import StateTag from "../components/StateTag.vue";
const auth = useAuth(),
  route = useRoute(),
  router = useRouter(),
  list = useList<RequestRow>("/requests"),
  { items, total, page, q, status, sort, loading, error } = list;
const catalog = ref<Catalog>(),
  drawer = ref(false),
  selected = ref<RequestRow>(),
  editing = ref(false),
  saving = ref(false),
  formError = ref("");
const title = ref(""),
  projectId = ref(0),
  lines = ref([{ materialId: 0, quantity: 1 }]),
  decision = ref("APPROVED"),
  comment = ref("");
const canSubmit = computed(() =>
  ["ADMIN", "ENGINEER"].includes(auth.user!.role),
);
const canApprove = computed(
  () =>
    selected.value?.status === "SUBMITTED" &&
    selected.value.requesterId !== auth.user!.id &&
    (["ADMIN"].includes(auth.user!.role) ||
      (auth.user!.role === "MANAGER" &&
        selected.value.requester.departmentId === auth.user!.departmentId)),
);
const totalCents = computed(() =>
  lines.value.reduce(
    (s, l) =>
      s +
      l.quantity *
        (catalog.value?.materials.find((m) => m.id === l.materialId)
          ?.unitCostCents ?? 0),
    0,
  ),
);
async function load() {
  await list.load();
}
function create() {
  selected.value = undefined;
  editing.value = true;
  title.value = "";
  projectId.value = catalog.value?.projects[0]?.id ?? 0;
  lines.value = [
    { materialId: catalog.value?.materials[0]?.id ?? 0, quantity: 1 },
  ];
  formError.value = "";
  drawer.value = true;
}
function view(row: RequestRow) {
  selected.value = row;
  editing.value = false;
  comment.value = "";
  formError.value = "";
  drawer.value = true;
}
function edit() {
  const row = selected.value!;
  editing.value = true;
  title.value = row.title;
  projectId.value = row.projectId;
  lines.value = row.lines.map((l) => ({
    materialId: l.materialId,
    quantity: l.quantity,
  }));
}
async function save() {
  saving.value = true;
  formError.value = "";
  try {
    await api(
      selected.value ? `/requests/${selected.value.id}/resubmit` : "/requests",
      {
        method: selected.value ? "PATCH" : "POST",
        body: JSON.stringify({
          title: title.value,
          projectId: projectId.value,
          lines: lines.value,
        }),
      },
    );
    drawer.value = false;
    ElMessage.success("請購已送出，等待主管審核");
    await load();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
async function approve() {
  saving.value = true;
  formError.value = "";
  try {
    await api(`/requests/${selected.value!.id}/approval`, {
      method: "POST",
      body: JSON.stringify({
        decision: decision.value,
        comment: comment.value,
      }),
    });
    drawer.value = false;
    ElMessage.success("簽核結果已儲存");
    await load();
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
function order() {
  drawer.value = false;
  router.push(`/orders?requestId=${selected.value!.id}`);
}
onMounted(async () => {
  try {
    catalog.value = await api<Catalog>("/catalog");
  } catch (e) {
    error.value = (e as Error).message;
  }
  await load();
  if (route.query.requestId)
    try {
      view(await api<RequestRow>(`/requests/${Number(route.query.requestId)}`));
    } catch (e) {
      error.value = (e as Error).message;
    }
});
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>請購與簽核</h1>
        <p>從需求提出到主管核准，保留每一次決策的依據。</p>
      </div>
      <el-button v-if="canSubmit" type="primary" @click="create">
        新增請購
      </el-button>
    </div>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div class="panel">
      <ListTools
        v-model:search="q"
        v-model:status="status"
        v-model:sort="sort"
        :statuses="{
          SUBMITTED: '待審核',
          RETURNED: '已退回',
          REJECTED: '已拒絕',
          APPROVED: '已核准',
          ORDERED: '已轉採購',
        }"
        @search="list.load(true)"
      />
      <el-table
        v-loading="loading"
        :data="items"
        row-key="id"
        empty-text="沒有符合條件的請購單，請調整篩選或新增請購。"
      >
        <el-table-column label="請購單據" min-width="260">
          <template #default="{ row }">
            <strong>{{ row.title }}</strong>
            <small class="cell-sub">{{ row.number }}</small>
          </template>
        </el-table-column>
        <el-table-column prop="project.name" label="工程專案" min-width="180" />
        <el-table-column prop="requester.name" label="申請人" width="100" />
        <el-table-column label="申請金額" min-width="130" align="right">
          <template #default="{ row }">
            {{
              money(
                (row as RequestRow).lines.reduce(
                  (s, l) => s + l.quantity * l.unitCostCents,
                  0,
                ),
              )
            }}
          </template>
        </el-table-column>
        <el-table-column label="狀態" width="110">
          <template #default="{ row }">
            <StateTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="送出時間" min-width="170">
          <template #default="{ row }">
            {{ date(row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="view(row)">
              檢視單據
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <span>共 {{ total }} 張請購單</span>
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="10"
          layout="prev,pager,next"
          @current-change="load"
        />
      </div>
    </div>
    <el-drawer
      v-model="drawer"
      :title="
        editing
          ? selected
            ? '修改並重新送審'
            : '新增請購申請'
          : '請購單據追蹤'
      "
      size="min(680px,100vw)"
      destroy-on-close
    >
      <div v-if="formError" class="error" role="alert">{{ formError }}</div>
      <form v-if="editing" class="entity-form" @submit.prevent="save">
        <label for="req-project">工程專案</label>
        <select
          id="req-project"
          v-model.number="projectId"
          :disabled="!!selected"
          required
        >
          <option v-for="p in catalog?.projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <label for="req-title">請購主旨</label>
        <input
          id="req-title"
          v-model="title"
          required
          maxlength="120"
          placeholder="例如：現場網路佈建備料"
        />
        <h3>物料明細</h3>
        <div v-for="(line, i) in lines" :key="i" class="line-form">
          <label :for="'req-material-' + i">物料 {{ i + 1 }}</label>
          <select
            :id="'req-material-' + i"
            v-model.number="line.materialId"
            required
          >
            <option v-for="m in catalog?.materials" :key="m.id" :value="m.id">
              {{ m.name }} · {{ money(m.unitCostCents) }}/{{ m.unit }}
            </option>
          </select>
          <label :for="'req-qty-' + i">數量</label>
          <input
            :id="'req-qty-' + i"
            v-model.number="line.quantity"
            type="number"
            min="1"
            max="100000"
            step="1"
            required
          />
          <el-button
            v-if="lines.length > 1"
            type="danger"
            text
            @click="lines.splice(i, 1)"
          >
            移除此列
          </el-button>
        </div>
        <el-button
          @click="
            lines.push({
              materialId: catalog?.materials[0]?.id ?? 0,
              quantity: 1,
            })
          "
        >
          新增明細
        </el-button>
        <div class="form-total">
          申請總額
          <strong>{{ money(totalCents) }}</strong>
        </div>
        <p class="muted">送出後由同部門主管簽核，核准前不計入預算承諾。</p>
        <div class="form-actions">
          <el-button @click="drawer = false">取消</el-button>
          <el-button type="primary" native-type="submit" :loading="saving">
            送出請購
          </el-button>
        </div>
      </form>
      <template v-else-if="selected">
        <div class="document-heading">
          <h2>{{ selected.title }}</h2>
          <span>{{ selected.number }}</span>
          <StateTag :status="selected.status" />
        </div>
        <dl class="details">
          <div>
            <dt>專案</dt>
            <dd>{{ selected.project.name }}</dd>
          </div>
          <div>
            <dt>申請人</dt>
            <dd>{{ selected.requester.name }}</dd>
          </div>
          <div>
            <dt>送出時間</dt>
            <dd>{{ date(selected.submittedAt) }}</dd>
          </div>
        </dl>
        <el-table :data="selected.lines">
          <el-table-column prop="material.name" label="物料" min-width="160" />
          <el-table-column prop="quantity" label="數量" width="80" />
          <el-table-column label="金額" min-width="120" align="right">
            <template #default="{ row }">
              {{ money(row.quantity * row.unitCostCents) }}
            </template>
          </el-table-column>
        </el-table>
        <h3>簽核歷程</h3>
        <p v-if="!selected.approvals.length" class="muted">尚無簽核紀錄。</p>
        <ol class="history">
          <li v-for="a in selected.approvals" :key="a.id">
            <div>
              <StateTag :status="a.decision" />
              {{ a.actor.name }}
              <small>{{ date(a.createdAt) }}</small>
            </div>
            <p>{{ a.comment }}</p>
          </li>
        </ol>
        <form
          v-if="canApprove"
          class="entity-form approval-form"
          @submit.prevent="approve"
        >
          <h3>處理簽核</h3>
          <label for="approval-decision">簽核結果</label>
          <select id="approval-decision" v-model="decision">
            <option value="APPROVED">核准</option>
            <option value="RETURNED">退回補件</option>
            <option value="REJECTED">拒絕</option>
          </select>
          <label for="approval-comment">簽核意見</label>
          <textarea
            id="approval-comment"
            v-model="comment"
            required
            maxlength="500"
            rows="3"
            placeholder="請說明核准或退回的依據"
          ></textarea>
          <el-button type="primary" native-type="submit" :loading="saving">
            送出簽核
          </el-button>
        </form>
        <el-button
          v-if="
            selected.status === 'RETURNED' &&
            selected.requesterId === auth.user!.id
          "
          type="primary"
          @click="edit"
        >
          修改並重新送審
        </el-button>
        <el-button
          v-if="
            selected.status === 'APPROVED' &&
            ['ADMIN', 'BUYER'].includes(auth.user!.role)
          "
          type="primary"
          @click="order"
        >
          建立採購單
        </el-button>
        <p v-if="selected.order" class="linked-document">
          已連結採購單：
          <router-link to="/orders">{{ selected.order.number }} →</router-link>
        </p>
      </template>
    </el-drawer>
  </section>
</template>
