import { once } from "node:events";
import { Writable } from "node:stream";
import { describe, expect, test } from "bun:test";
import { createServerLogger } from "./server.js";

const config = {
  logFormat: "pretty",
} as const;

describe("server logger", () => {
  test("stops writing when the desktop output stream reports EIO", async () => {
    let writes = 0;
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        writes += 1;
        callback(Object.assign(new Error("write EIO"), { code: "EIO" }));
      },
    });
    const streamError = once(output, "error");
    const logger = createServerLogger(config, output);

    logger.log("info", "first request");
    const [error] = await streamError;
    expect(error).toMatchObject({ code: "EIO" });

    logger.log("info", "second request");
    expect(writes).toBe(1);
  });
});
