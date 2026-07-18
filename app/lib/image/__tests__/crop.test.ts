import { describe, it, expect } from "vitest";
import { computeCoverCrop } from "../crop";

describe("computeCoverCrop", () => {
  it("crops the sides of a landscape source to the centered square", () => {
    // 1600x900 -> largest centered square is 900x900, centered horizontally.
    expect(computeCoverCrop(1600, 900, 512)).toEqual({
      sx: 350,
      sy: 0,
      sw: 900,
      sh: 900,
    });
  });

  it("crops the top/bottom of a portrait source to the centered square", () => {
    // 900x1600 -> largest centered square is 900x900, centered vertically.
    expect(computeCoverCrop(900, 1600, 512)).toEqual({
      sx: 0,
      sy: 350,
      sw: 900,
      sh: 900,
    });
  });

  it("is a no-op crop for a square source", () => {
    expect(computeCoverCrop(800, 800, 512)).toEqual({
      sx: 0,
      sy: 0,
      sw: 800,
      sh: 800,
    });
  });

  it("is independent of the target size", () => {
    expect(computeCoverCrop(1600, 900, 128)).toEqual(
      computeCoverCrop(1600, 900, 2048)
    );
  });

  it("handles odd dimensions by centering with a fractional offset", () => {
    // 101x50 -> square side 50, sx = (101-50)/2 = 25.5
    expect(computeCoverCrop(101, 50, 512)).toEqual({
      sx: 25.5,
      sy: 0,
      sw: 50,
      sh: 50,
    });
  });
});
