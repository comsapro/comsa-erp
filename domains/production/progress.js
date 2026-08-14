export function computeProgress(items = []) {
  const countable = items.filter((i) => i.status !== "CANCELLED");
  const totalItems = countable.length;
  const completedItems = countable.filter((i) => i.status === "COMPLETED").length;
  const progressPercentage =
    totalItems === 0
      ? 0
      : Math.round((completedItems / totalItems) * 10000) / 100;
  return { totalItems, completedItems, progressPercentage };
}

export function canOrderBeCompleted(items = []) {
  const countable = items.filter((i) => i.status !== "CANCELLED");
  return (
    countable.length > 0 && countable.every((i) => i.status === "COMPLETED")
  );
}

export function deriveOrderStatus(currentStatus, items = []) {
  if (currentStatus === "CANCELLED") return "CANCELLED";
  const countable = items.filter((i) => i.status !== "CANCELLED");
  if (canOrderBeCompleted(countable)) return "COMPLETED";
  const hasStarted = countable.some((i) =>
    ["IN_PROGRESS", "COMPLETED", "REWORK"].includes(i.status)
  );
  if (hasStarted || currentStatus === "IN_PROGRESS" || currentStatus === "COMPLETED") {
    return "IN_PROGRESS";
  }
  return "PENDING";
}
