import test from "node:test";
import assert from "node:assert/strict";
import {
  getProjectedSheetOffset,
  getSheetDragOffset,
  project,
  rubberBand,
  shouldDismissSheet,
} from "./bottom-sheet-motion.ts";

test("projects downward velocity into a future resting point", () => {
  assert.equal(project(0), 0);
  assert.ok(project(500) > 200);
  assert.equal(getProjectedSheetOffset(80, -200), 80);
});

test("rubber-band resistance softens the upward boundary", () => {
  assert.equal(getSheetDragOffset(40, 600), 40);
  assert.ok(getSheetDragOffset(-40, 600) < 0);
  assert.ok(Math.abs(getSheetDragOffset(-600, 600)) < 600);
  assert.ok(Math.abs(rubberBand(-1200, 600)) < Math.abs(rubberBand(-600, 600)) * 2);
});

test("dismisses after a projected flick or meaningful pull", () => {
  assert.equal(shouldDismissSheet({ offset: 24, velocity: 900, sheetHeight: 600 }), true);
  assert.equal(shouldDismissSheet({ offset: 300, velocity: 0, sheetHeight: 600 }), true);
  assert.equal(shouldDismissSheet({ offset: 20, velocity: 0, sheetHeight: 600 }), false);
});
