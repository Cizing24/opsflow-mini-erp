import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import ElementPlus from "element-plus";
import zhTw from "element-plus/es/locale/lang/zh-tw.mjs";
import "element-plus/dist/index.css";
import "./style.css";
import App from "./App.vue";
import Dashboard from "./pages/Dashboard.vue";
import Projects from "./pages/Projects.vue";
import Requests from "./pages/Requests.vue";
import Orders from "./pages/Orders.vue";
import Inventory from "./pages/Inventory.vue";
import Masters from "./pages/Masters.vue";
import Guide from "./pages/Guide.vue";
import Audit from "./pages/Audit.vue";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Dashboard, meta: { title: "營運工作台" } },
    { path: "/projects", component: Projects, meta: { title: "工程專案" } },
    { path: "/requests", component: Requests, meta: { title: "請購與簽核" } },
    { path: "/orders", component: Orders, meta: { title: "採購與收貨" } },
    { path: "/inventory", component: Inventory, meta: { title: "庫存與領料" } },
    { path: "/masters", component: Masters, meta: { title: "供應商與物料" } },
    { path: "/guide", component: Guide, meta: { title: "操作導覽" } },
    { path: "/audit", component: Audit, meta: { title: "稽核紀錄" } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
createApp(App)
  .use(createPinia())
  .use(router)
  .use(ElementPlus, { locale: zhTw })
  .mount("#app");
