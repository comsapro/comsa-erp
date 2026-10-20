import test from "node:test";
import assert from "node:assert/strict";
import { assertE2eDatabase } from "../e2e/env.js";

test("assertE2eDatabase acepta el postgres local de docker-compose.e2e", () => {
  assert.doesNotThrow(() =>
    assertE2eDatabase("postgresql://comsa:comsa@127.0.0.1:54329/comsa_e2e?schema=public")
  );
});

test("assertE2eDatabase rechaza una URL que no es comsa_e2e", () => {
  assert.throws(
    () =>
      assertE2eDatabase(
        "postgresql://user:secret@ep-young-rain.aws.neon.tech/neondb?sslmode=require"
      ),
    /se niega/
  );
});
