import assert from "node:assert/strict";
import test from "node:test";
import {
  isPubliclyAvailableOnServiceDate
} from "@/lib/special-menu-availability";

test("supports recurring weekday availability", () => {
  const weekend = { days: [0, 5, 6] };
  assert.equal(isPubliclyAvailableOnServiceDate(weekend, "2026-08-14"), true);
  assert.equal(isPubliclyAvailableOnServiceDate(weekend, "2026-08-15"), true);
  assert.equal(isPubliclyAvailableOnServiceDate(weekend, "2026-08-16"), true);
  assert.equal(isPubliclyAvailableOnServiceDate(weekend, "2026-08-17"), false);
});

test("supports optional schedule date boundaries", () => {
  const schedule = { days: [5, 6, 0], startDate: "2026-08-14", endDate: "2026-08-30" };
  assert.equal(isPubliclyAvailableOnServiceDate(schedule, "2026-08-07"), false);
  assert.equal(isPubliclyAvailableOnServiceDate(schedule, "2026-08-15"), true);
  assert.equal(isPubliclyAvailableOnServiceDate(schedule, "2026-09-05"), false);
});
