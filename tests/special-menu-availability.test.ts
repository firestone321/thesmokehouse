import assert from "node:assert/strict";
import test from "node:test";
import {
  isFridayThroughSundayServiceDate,
  isPubliclyAvailableOnServiceDate,
  isWeekendSpecialMenuItem
} from "@/lib/special-menu-availability";

test("identifies the two weekend-only menu items", () => {
  assert.equal(isWeekendSpecialMenuItem("Beef oxtail"), true);
  assert.equal(isWeekendSpecialMenuItem("Oxtail"), true);
  assert.equal(isWeekendSpecialMenuItem("Beef ribs"), true);
  assert.equal(isWeekendSpecialMenuItem("Country Platter for Four"), false);
});

test("only Friday through Sunday are public special-item days", () => {
  assert.equal(isFridayThroughSundayServiceDate("2026-08-14"), true);
  assert.equal(isFridayThroughSundayServiceDate("2026-08-15"), true);
  assert.equal(isFridayThroughSundayServiceDate("2026-08-16"), true);
  assert.equal(isFridayThroughSundayServiceDate("2026-08-17"), false);
});

test("keeps the Country Platter available while direct special items are weekday-blocked", () => {
  assert.equal(isPubliclyAvailableOnServiceDate("Beef oxtail", "2026-08-17"), false);
  assert.equal(isPubliclyAvailableOnServiceDate("Beef ribs", "2026-08-17"), false);
  assert.equal(isPubliclyAvailableOnServiceDate("Country Platter for Four", "2026-08-17"), true);
});
