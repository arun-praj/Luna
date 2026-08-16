import test from "node:test";
import assert from "node:assert/strict";
import {
  getAccountSwipeDragOffset,
  getProjectedAccountSwipeOffset,
  projectAccountSwipe,
  rubberBandAccountSwipe,
  shouldOpenAccountSwipe,
} from "./account-swipe-motion.ts";

test("projects a release velocity in the direction of the flick", () => {
  assert.equal(projectAccountSwipe(0), 0);
  assert.ok(projectAccountSwipe(720) > 300);
  assert.ok(getProjectedAccountSwipeOffset(80, -220) < 80);
});

test("uses resistance on both sides of the action range", () => {
  assert.equal(getAccountSwipeDragOffset(44, 88), 44);
  assert.ok(getAccountSwipeDragOffset(-40, 88) < 0);
  assert.ok(getAccountSwipeDragOffset(128, 88) > 88);
  assert.ok(Math.abs(rubberBandAccountSwipe(-880, 88)) < 880);
});

test("opens on a projected flick or a deliberate pull", () => {
  assert.equal(shouldOpenAccountSwipe({ offset: 16, velocity: 720, actionWidth: 88 }), true);
  assert.equal(shouldOpenAccountSwipe({ offset: 50, velocity: 0, actionWidth: 88 }), true);
  assert.equal(shouldOpenAccountSwipe({ offset: 30, velocity: 0, actionWidth: 88 }), false);
  assert.equal(shouldOpenAccountSwipe({ offset: 88, velocity: -900, actionWidth: 88 }), false);
});
