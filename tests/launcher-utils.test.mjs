import assert from "node:assert/strict";
import test from "node:test";

import { clampFloatingPosition } from "../scripts/launcher-utils.mjs";

test("floating shortcut stays inside the viewport", () => {
  assert.deepEqual(
    clampFloatingPosition(
      { left: 900, top: -20, locked: true },
      { width: 800, height: 600 },
      { width: 180, height: 50 }
    ),
    { left: 620, top: 0, locked: true }
  );
});

test("floating shortcut preserves a valid position", () => {
  assert.deepEqual(
    clampFloatingPosition(
      { left: 120, top: 180, locked: false },
      { width: 1920, height: 1080 },
      { width: 180, height: 50 }
    ),
    { left: 120, top: 180, locked: false }
  );
});
