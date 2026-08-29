import { once } from "node:events";
import { Writable } from "node:stream";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { createServerLogger } from "../../apps/server/src/server.js";

test("desktop request logging survives a closed output channel", async ({ evidence }) => {
  let writes = 0;
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      writes += 1;
      callback(Object.assign(new Error("write EIO"), { code: "EIO" }));
    },
  });
  const streamError = once(output, "error");
  const logger = createServerLogger({ logFormat: "pretty" }, output);

  logger.log("info", "first request");
  const [error] = await streamError;
  expect(error).toMatchObject({ code: "EIO" });

  logger.log("info", "second request");
  expect(writes).toBe(1);

  evidence.fact(
    "A closed desktop output channel cannot crash request logging",
    "The logger observes EIO, disables the failed output sink, and does not attempt the second write",
    true,
  );
});
