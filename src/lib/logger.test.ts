import { describe, expect, it } from "vitest";
import { createPinoLogger } from "./logger.js";

type LogLine = Record<string, unknown> & {
  caller?: string;
  traceback?: string;
  err?: { type?: string; message?: string; stack?: string; cause?: { message?: string; stack?: string } };
  error?: { stack?: string };
};

function loggerWithCapture() {
  const lines: LogLine[] = [];
  const logger = createPinoLogger({
    level: "debug",
    pretty: false,
    destination: {
      write(msg: string) {
        const text = msg.toString().trim();
        if (text) lines.push(JSON.parse(text) as LogLine);
      },
    },
  });
  return { logger, lines };
}

describe("createPinoLogger", () => {
  it("puts the throw site and traceback on Error logs", () => {
    const { logger, lines } = loggerWithCapture();
    const err = new Error("boom");
    logger.error({ err, userId: "u1" }, "Failed to generate recipe");

    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("Failed to generate recipe");
    expect(lines[0].userId).toBe("u1");
    expect(lines[0].caller).toMatch(/src\/lib\/logger\.test\.ts:\d+:\d+/);
    expect(lines[0].err?.message).toBe("boom");
    expect(lines[0].err?.stack).toContain("boom");
    expect(lines[0].err?.stack).toMatch(/logger\.test\.ts/);
    expect(lines[0].traceback).toBeUndefined();
  });

  it("captures a traceback when the error object has no stack", () => {
    const { logger, lines } = loggerWithCapture();
    logger.error({ err: { message: "db down", code: "PGRST301" } }, "Failed to list recipes");

    expect(lines).toHaveLength(1);
    expect(lines[0].caller).toMatch(/src\/lib\/logger\.test\.ts:\d+:\d+/);
    expect(lines[0].err?.message).toBe("db down");
    expect(lines[0].err?.stack).toContain("Error: logged here");
    expect(lines[0].err?.stack).toMatch(/logger\.test\.ts/);
  });

  it("still records caller and traceback when no err object is passed", () => {
    const { logger, lines } = loggerWithCapture();
    logger.error("Generated recipe failed validation");

    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("Generated recipe failed validation");
    expect(lines[0].caller).toMatch(/src\/lib\/logger\.test\.ts:\d+:\d+/);
    expect(lines[0].traceback).toContain("Error: logged here");
    expect(lines[0].traceback).toMatch(/logger\.test\.ts/);
  });

  it("serializes Error.cause into the traceback", () => {
    const { logger, lines } = loggerWithCapture();
    const cause = new Error("root");
    logger.error({ err: new Error("wrapper", { cause }) }, "nested");

    expect(lines[0].err?.cause?.message).toBe("root");
    expect(lines[0].err?.cause?.stack).toContain("root");
  });

  it("does not attach caller or traceback on info logs", () => {
    const { logger, lines } = loggerWithCapture();
    logger.info({ userId: "u1" }, "Generating recipe");

    expect(lines).toHaveLength(1);
    expect(lines[0].caller).toBeUndefined();
    expect(lines[0].traceback).toBeUndefined();
  });
});
