<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { money } from "@opsflow/shared";
import { api, useAuth } from "../api";
import { useList } from "../useList";
import type { Catalog, Project } from "../types";
import ListTools from "../components/ListTools.vue";
import StateTag from "../components/StateTag.vue";
const auth = useAuth(),
  list = useList<Project>("/projects"),
  { items, total, page, q, sort, status, loading, error } = list,
  catalog = ref<Catalog>();
const drawer = ref(false),
  editing = ref(false),
  selected = ref<Project>(),
  name = ref(""),
  budget = ref(0),
  ownerId = ref(0),
  memberIds = ref<number[]>([]),
  projectStatus = ref("ACTIVE"),
  saving = ref(false),
  formError = ref(""),
  materialId = ref(0),
  quantity = ref(1);
function create() {
  selected.value = undefined;
  editing.value = true;
  name.value = "";
  budget.value = 1000000;
  ownerId.value =
    catalog.value?.users.find((u) => u.role === "ENGINEER")?.id ?? 0;
  memberIds.value = [ownerId.value];
  projectStatus.value = "ACTIVE";
  formError.value = "";
  drawer.value = true;
}
function view(row: Project) {
  selected.value = row;
  editing.value = false;
  materialId.value = catalog.value?.materials[0]?.id ?? 0;
  quantity.value = 1;
  formError.value = "";
  drawer.value = true;
}
function edit() {
  const row = selected.value!;
  editing.value = true;
  name.value = row.name;
  budget.value = row.budgetCents / 100;
  ownerId.value = row.ownerId;
  memberIds.value = row.members.map((m) => m.userId);
  projectStatus.value = row.status;
}
async function save() {
  saving.value = true;
  formError.value = "";
  try {
    await api(selected.value ? `/projects/${selected.value.id}` : "/projects", {
      method: selected.value ? "PATCH" : "POST",
      body: JSON.stringify({
        name: name.value,
        budgetCents: Math.round(budget.value * 100),
        ownerId: ownerId.value,
        memberIds: memberIds.value,
        status: projectStatus.value,
      }),
    });
    drawer.value = false;
    ElMessage.success("專案資料已儲存");
    await list.load();
    catalog.value = await api<Catalog>("/catalog");
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
async function requirement() {
  saving.value = true;
  formError.value = "";
  try {
    await api(`/projects/${selected.value!.id}/requirements`, {
      method: "POST",
      body: JSON.stringify({
        materialId: materialId.value,
        quantity: quantity.value,
      }),
    });
    drawer.value = false;
    ElMessage.success("物料需求已更新");
    await list.load();
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
    error.value = (e as Error).message;
  }
  await list.load();
});
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>工程專案</h1>
        <p>整合預算、團隊與物料需求，分開追蹤承諾及實際成本。</p>
      </div>
      <el-button
        v-if="['ADMIN', 'MANAGER'].includes(auth.user!.role)"
        type="primary"
        @click="create"
        >
建立專案
</el-button
      >
    </div>
    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <div class="panel">
      <ListTools
        v-model:search="q"
        v-model:sort="sort"
        v-model:status="status"
        :statuses="{ ACTIVE: '進行中', PLANNED: '規劃中', COMPLETED: '已完工' }"
        @search="list.load(true)"
      /><el-table
        v-loading="loading"
        :data="items"
        empty-text="沒有符合條件的工程專案。"
        >
<el-table-column label="工程專案" min-width="240"
          >
<template #default="{ row }"
            >
<strong>{{ row.name }}</strong
            ><small class="cell-sub">{{ row.code }}</small>
</template
          >
</el-table-column
        ><el-table-column
          prop="owner.name"
          label="負責人"
          width="100"
        /><el-table-column label="預算" min-width="130" align="right"
          >
<template #default="{ row }">
{{
            money(row.budgetCents)
          }}
</template>
</el-table-column
        ><el-table-column label="已核准承諾" min-width="130" align="right"
          >
<template #default="{ row }">
{{
            money(row.committedCents)
          }}
</template>
</el-table-column
        ><el-table-column label="實際領用成本" min-width="140" align="right"
          >
<template #default="{ row }">
{{
            money(row.actualCents)
          }}
</template>
</el-table-column
        ><el-table-column label="狀態" width="100"
          >
<template #default="{ row }"
            >
<StateTag :status="row.status" />
</template>
</el-table-column
        ><el-table-column label="操作" width="100" fixed="right"
          >
<template #default="{ row }"
            >
<el-button type="primary" link @click="view(row)"
              >
專案明細
</el-button
            >
</template
          >
</el-table-column
        >
</el-table
      >
      <div class="pagination">
        <span>共 {{ total }} 個專案</span
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
      :title="
        editing ? (selected ? '修改專案' : '建立工程專案') : '工程專案明細'
      "
      size="min(640px,100vw)"
      destroy-on-close
      >
<div v-if="formError" class="error" role="alert">{{ formError }}</div>
      <form v-if="editing" class="entity-form" @submit.prevent="save">
        <label for="project-name">專案名稱</label
        ><input
          id="project-name"
          v-model="name"
          required
          maxlength="120"
        /><label for="project-budget">預算（TWD）</label
        ><input
          id="project-budget"
          v-model.number="budget"
          type="number"
          min="0"
          max="10000000"
          step="0.01"
          required
        /><label for="project-owner">專案負責人</label
        ><select id="project-owner" v-model.number="ownerId" required>
          <option v-for="u in catalog?.users" :key="u.id" :value="u.id">
            {{ u.name }}
          </option>
</select
        ><label for="project-members">專案成員（Ctrl / Cmd 可複選）</label
        ><select id="project-members" v-model="memberIds" multiple size="5">
          <option v-for="u in catalog?.users" :key="u.id" :value="u.id">
            {{ u.name }}
          </option>
</select
        ><label for="project-status">專案狀態</label
        ><select id="project-status" v-model="projectStatus">
          <option value="PLANNED">規劃中</option>
          <option value="ACTIVE">進行中</option>
          <option value="COMPLETED">已完工</option>
        </select>
        <div class="form-actions">
          <el-button @click="drawer = false">取消</el-button
          ><el-button type="primary" native-type="submit" :loading="saving"
            >
儲存專案
</el-button
          >
        </div>
      </form>
      <template v-else-if="selected"
        >
<div class="document-heading">
          <h2>{{ selected.name }}</h2>
          <span>{{ selected.code }}</span
          ><StateTag :status="selected.status" />
        </div>
        <dl class="details">
          <div>
            <dt>負責人</dt>
            <dd>{{ selected.owner?.name }}</dd>
          </div>
          <div>
            <dt>專案成員</dt>
            <dd>
              {{
                selected.members.map((m) => m.user?.name).join("、") ||
                "尚無成員"
              }}
            </dd>
          </div>
          <div>
            <dt>預算</dt>
            <dd>{{ money(selected.budgetCents) }}</dd>
          </div>
          <div>
            <dt>已核准承諾</dt>
            <dd>{{ money(selected.committedCents) }}</dd>
          </div>
          <div>
            <dt>實際領用成本</dt>
            <dd>{{ money(selected.actualCents) }}</dd>
          </div>
        </dl>
        <el-button
          v-if="['ADMIN', 'MANAGER'].includes(auth.user!.role)"
          @click="edit"
          >
修改專案
</el-button
        >
        <h3>專案物料需求</h3>
        <el-table :data="selected.requirements" empty-text="尚未登錄物料需求"
          >
<el-table-column prop="material.name" label="物料" /><el-table-column
            prop="quantity"
            label="需求數量"
            width="110"
        />
</el-table>
        <form
          v-if="['ADMIN', 'MANAGER', 'ENGINEER'].includes(auth.user!.role)"
          class="entity-form"
          @submit.prevent="requirement"
        >
          <h3>設定物料需求</h3>
          <label for="requirement-material">需求物料</label
          ><select id="requirement-material" v-model.number="materialId">
            <option v-for="m in catalog?.materials" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
</select
          ><label for="requirement-quantity">需求數量</label
          ><input
            id="requirement-quantity"
            v-model.number="quantity"
            type="number"
            min="1"
            step="1"
            required
          /><el-button type="primary" native-type="submit" :loading="saving"
            >
更新需求
</el-button
          >
        </form>
</template
      >
</el-drawer
    >
  </section>
</template>
