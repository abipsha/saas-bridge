import { describe, it, expect } from "vitest";
import { safeEqual } from "../src/core/verify";

describe("safeEqual (webhook URL token check)", () => {
  it("returns true for identical tokens", () => {
    expect(safeEqual("s3cr3t-token", "s3cr3t-token")).toBe(true);
  });

  it("returns false for different tokens of equal length", () => {
    expect(safeEqual("s3cr3t-tokenA", "s3cr3t-tokenB")).toBe(false);
  });

  it("returns false for tokens of different length", () => {
    expect(safeEqual("short", "a-much-longer-token")).toBe(false);
  });

  it("returns false when one side is empty", () => {
    expect(safeEqual("", "something")).toBe(false);
  });
});
