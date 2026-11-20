<script setup lang="ts">
const steps = [
  {
    role: "工程師",
    title: "提出工程需求",
    path: "/requests",
    action: "新增請購",
    text: "選擇進行中的專案、填寫請購主旨及物料數量，送出後狀態為待審核。請先記下單號或主旨。",
  },
  {
    role: "部門主管",
    title: "確認規格與預算",
    path: "/requests",
    action: "檢視單據 → 送出簽核",
    text: "搜尋剛才的主旨，檢查需求與金額，輸入簽核意見。可核准、退回補件或拒絕；核准後計入預算承諾。",
  },
  {
    role: "採購人員",
    title: "建立供應商採購單",
    path: "/orders",
    action: "建立採購單",
    text: "選擇已核准請購、供應商與預計到貨日。同一張請購僅能建立一張採購單。",
  },
  {
    role: "倉儲人員",
    title: "登錄部分到貨",
    path: "/orders",
    action: "檢視與收貨",
    text: "選擇入庫倉庫，先收一部分數量。系統同步更新庫存與待收量，並保留每批收貨紀錄。",
  },
  {
    role: "工程師",
    title: "領料投入專案",
    path: "/inventory",
    action: "專案領料",
    text: "選擇領用專案、物料與剛才的收貨倉庫，輸入數量與用途。庫存不足時交易會被拒絕。",
  },
  {
    role: "系統管理員",
    title: "核對成本與軌跡",
    path: "/",
    action: "營運工作台",
    text: "確認專案實際成本增加，預算承諾與實際領用分別顯示。稽核紀錄可查詢每次操作與追蹤編號。",
  },
];
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>從需求到領料，走完一筆工程交易</h1>
        <p>Guided Demo · 每一步都會實際寫入資料庫，請依序切換角色操作。</p>
      </div>
    </div>
    <div class="guide-intro panel">
      <h2>開始前</h2>
      <p>
        右上角的登出按鈕可切換角色。各帳號為
        admin、manager、engineer、buyer、warehouse 加上
        <code>@opsflow.test</code>
        ；密碼由本機
        <code>.env</code>
        的
        <code>DEMO_PASSWORD</code>
        設定。
      </p>
      <p>
        請選擇預算餘額足夠的專案，採購 10 件物料、先收 4 件，再領 1
        件，即可觀察部分收貨與成本變化。
      </p>
    </div>
    <ol class="guide-steps">
      <li v-for="(step, index) in steps" :key="step.title">
        <span class="step-number">{{ index + 1 }}</span>
        <div>
          <span class="role-label">{{ step.role }}</span>
          <h2>{{ step.title }}</h2>
          <p>{{ step.text }}</p>
          <router-link :to="step.path">{{ step.action }} →</router-link>
        </div>
      </li>
    </ol>
    <section class="panel guide-intro">
      <h2>如何核對結果</h2>
      <p>
        請購狀態：待審核 → 已核准 → 已轉採購。採購狀態：待收貨 → 部分收貨 →
        已收齊。
      </p>
      <p>
        庫存：收貨增加，領料減少。專案成本：領料數量 ×
        物料固定標準成本。預算承諾：已核准或已轉採購的請購總額。
      </p>
      <p>
        所有公司、人物、供應商與工程交易皆為合成資料；公開來源物料會標註「公開資料衍生」。
      </p>
    </section>
  </section>
</template>
