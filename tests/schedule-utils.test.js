import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveScheduleSpan,
  addDays,
  buildDayRange,
} from "../domains/production/schedule-utils.js";

test("resolveScheduleSpan usa planeacion cuando existe", () => {
  const span = resolveScheduleSpan({
    plannedStartAt: "2026-03-01",
    plannedEndAt: "2026-03-05",
    commitmentDate: "2026-03-10",
    productionOrder: { estimatedDeliveryDate: "2026-03-20" },
  });
  assert.equal(span.start, "2026-03-01");
  assert.equal(span.end, "2026-03-05");
  assert.equal(span.source, "planned");
});

test("resolveScheduleSpan cae a entrega aproximada de la OP", () => {
  const span = resolveScheduleSpan({
    productionOrder: { estimatedDeliveryDate: "2026-04-15" },
  });
  assert.equal(span.start, "2026-04-15");
  assert.equal(span.end, "2026-04-15");
  assert.equal(span.source, "estimated");
});

test("buildDayRange genera dias inclusivos", () => {
  const days = buildDayRange("2026-01-01", "2026-01-03");
  assert.deepEqual(days, ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.equal(addDays("2026-01-01", 2), "2026-01-03");
});
