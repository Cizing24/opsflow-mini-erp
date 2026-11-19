<script setup lang="ts">
import { statusLabels } from "@opsflow/shared";
defineProps<{ status: string }>();
const tones: Record<
  string,
  "primary" | "success" | "warning" | "danger" | "info"
> = {
  SUBMITTED: "warning",
  RETURNED: "warning",
  REJECTED: "danger",
  APPROVED: "success",
  ORDERED: "primary",
  OPEN: "info",
  PARTIAL: "warning",
  RECEIVED: "success",
  ACTIVE: "success",
  COMPLETED: "info",
  PLANNED: "primary",
  IN: "success",
  OUT: "primary",
};
</script>
<template>
  <el-tag :type="tones[status] ?? 'info'" effect="light" size="small">
    {{ statusLabels[status] ?? status }}
  </el-tag>
</template>
