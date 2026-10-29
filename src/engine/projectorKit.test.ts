import { describe, expect, it } from "vitest";
import { amazonHost, amazonLink, kit } from "./projectorKit";

describe("projector kit", () => {
  it("sends each sewist to their own Amazon", () => {
    expect(amazonHost("en-CA")).toBe("www.amazon.ca");
    expect(amazonHost("fr-CA")).toBe("www.amazon.ca");
    expect(amazonHost("en-GB")).toBe("www.amazon.co.uk");
    expect(amazonHost("en-US")).toBe("www.amazon.com");
  });

  it("adds the Associates tag only once there is one", () => {
    const mat = kit("cm")[3];
    expect(amazonLink(mat, "en-CA", "")).toBe(
      "https://www.amazon.ca/s?k=self+healing+cutting+mat+60+x+45+cm+grid",
    );
    expect(amazonLink(mat, "en-CA", "maisontrace-20")).toContain(
      "&tag=maisontrace-20",
    );
  });

  it("sizes the mat in the sewist’s unit", () => {
    expect(kit("in")[3].why).toMatch(/^24 × 18 in/);
    expect(kit("cm")[3].why).toMatch(/^60 × 45 cm/);
  });
});
