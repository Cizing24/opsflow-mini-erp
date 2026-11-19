<script setup lang="ts">
import { ref,onMounted } from 'vue';
import { useRoute,useRouter } from 'vue-router';
import { House,FolderOpened,DocumentChecked,ShoppingCart,Box,Connection,Guide,Document,SwitchButton,Operation } from '@element-plus/icons-vue';
import { roleLabels,type Role } from '@opsflow/shared';
import { useAuth } from './api';
const auth=useAuth(),route=useRoute(),router=useRouter();
const email=ref('engineer@opsflow.test'),password=ref(''),error=ref(''),busy=ref(false),mobileNav=ref(false);
const nav=[{path:'/',name:'營運工作台',icon:House},{path:'/projects',name:'工程專案',icon:FolderOpened},{path:'/requests',name:'請購與簽核',icon:DocumentChecked},{path:'/orders',name:'採購與收貨',icon:ShoppingCart},{path:'/inventory',name:'庫存與領料',icon:Box},{path:'/masters',name:'供應商與物料',icon:Connection},{path:'/audit',name:'稽核紀錄',icon:Document,roles:['ADMIN']},{path:'/guide',name:'操作導覽',icon:Guide}];
async function login(){busy.value=true;error.value='';try{await auth.login(email.value,password.value);password.value='';await router.push('/');}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function logout(){try{await auth.logout();password.value='';}catch(e){error.value=(e as Error).message;}}
onMounted(auth.restore);
</script>
<template>
  <div v-if="!auth.ready" class="boot" role="status">正在連接營運工作區…</div>
  <div v-else-if="!auth.user" class="login-layout">
    <section class="login-story"><div class="brand"><span class="brand-mark">O</span>OpsFlow <span class="brand-erp">ERP</span></div><div><h1>讓每一筆資源，<br>都有清楚的去向。</h1><p>從工程需求到採購、收貨與專案領料，<br>在同一個工作區完成跨部門協作。</p><ol class="login-flow"><li>提出需求</li><li>主管簽核</li><li>採購收貨</li><li>專案領料</li></ol></div><p class="login-note">海嶼系統整合有限公司 · 虛構企業展示環境</p></section>
    <main class="login-form"><form @submit.prevent="login"><h2>登入營運工作區</h2><p class="muted">選擇角色帳號，接續您的工作。</p><div v-if="error" class="error" role="alert">{{ error }}</div><label for="login-email">電子郵件</label><input id="login-email" v-model="email" type="email" autocomplete="username" required><label for="login-password">密碼</label><input id="login-password" v-model="password" type="password" autocomplete="current-password" required minlength="8"><el-button type="primary" native-type="submit" :loading="busy" class="login-submit">登入工作區</el-button><div class="demo-accounts"><strong>本機 Demo 帳號</strong><button v-for="(label,role) in roleLabels" :key="role" type="button" @click="email=({ADMIN:'admin',MANAGER:'manager',ENGINEER:'engineer',BUYER:'buyer',WAREHOUSE:'warehouse'} as Record<Role,string>)[role]+'@opsflow.test'">{{ label }}</button><small>密碼由本機 .env 的 DEMO_PASSWORD 設定。所有資料均為模擬，無真實採購。</small></div></form></main>
  </div>
  <div v-else class="workspace">
    <a href="#main-content" class="skip-link">跳到主要內容</a>
    <aside class="sidebar" :class="{open:mobileNav}"><router-link to="/" class="brand" @click="mobileNav=false"><span class="brand-mark">O</span>OpsFlow <span class="brand-erp">ERP</span></router-link><div class="company-name">海嶼系統整合有限公司<span>工程營運工作區</span></div><nav aria-label="主要導覽"><template v-for="item in nav" :key="item.path"><router-link v-if="!item.roles||item.roles.includes(auth.user.role)" :to="item.path" :class="{selected:route.path===item.path}" @click="mobileNav=false"><el-icon><component :is="item.icon" /></el-icon>{{ item.name }}</router-link></template></nav><div class="sidebar-bottom"><span class="environment-dot"></span>本機展示環境<small>所有交易均為合成資料</small><a href="/api/docs" target="_blank" rel="noopener">API 文件 ↗</a></div></aside>
    <div class="workspace-body"><header class="topbar"><div class="breadcrumb"><button class="nav-toggle" aria-label="切換導覽" @click="mobileNav=!mobileNav"><el-icon><Operation /></el-icon></button><span>工程營運</span><span class="slash">/</span><strong>{{ route.meta.title }}</strong></div><div class="account"><span class="avatar">{{ auth.user.name.slice(0,1) }}</span><span>{{ auth.user.name }}<small>{{ roleLabels[auth.user.role] }}</small></span><el-button text aria-label="登出並切換角色" @click="logout"><el-icon><SwitchButton /></el-icon></el-button></div></header><main id="main-content" tabindex="-1"><div v-if="error" class="error" role="alert">{{ error }}</div><router-view :key="auth.user.id" /></main><footer class="workspace-footer">OpsFlow ERP <span>資料可追溯，協作有依據。</span></footer></div>
  </div>
</template>
