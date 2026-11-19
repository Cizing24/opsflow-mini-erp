<script setup lang="ts">
import { onMounted } from 'vue';
import { useList } from '../useList';
import { date } from '../api';
import ListTools from '../components/ListTools.vue';
interface AuditRow {id:number;actor?:{name:string};action:string;entity:string;requestId:string;createdAt:string;detail:unknown}
const list=useList<AuditRow>('/audit'),{items,total,page,q,sort,loading,error}=list;
onMounted(()=>list.load());
</script>
<template><section><div class="page-heading"><div><h1>稽核紀錄</h1><p>查詢操作人、單據與 Request ID，追蹤每一次關鍵變更。</p></div></div><div v-if="error" class="error" role="alert">{{ error }}</div><div class="panel"><ListTools v-model:search="q" v-model:sort="sort" @search="list.load(true)" /><el-table v-loading="loading" :data="items" empty-text="沒有符合條件的稽核紀錄。"><el-table-column label="時間" min-width="170"><template #default="{row}">{{ date(row.createdAt) }}</template></el-table-column><el-table-column label="操作人" width="100"><template #default="{row}">{{ row.actor?.name??'系統' }}</template></el-table-column><el-table-column prop="action" label="操作" min-width="220" /><el-table-column prop="entity" label="關聯單據" min-width="150" /><el-table-column prop="requestId" label="Request ID" min-width="320" /><el-table-column label="詳細資料" min-width="280"><template #default="{row}">{{ JSON.stringify(row.detail) }}</template></el-table-column></el-table><div class="pagination"><span>共 {{ total }} 筆紀錄</span><el-pagination v-model:current-page="page" :total="total" :page-size="10" layout="prev,pager,next" @current-change="list.load()" /></div></div></section></template>
