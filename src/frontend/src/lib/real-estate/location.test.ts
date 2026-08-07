import { describe, expect, it } from "vitest";

import { toShortLocation } from "@/lib/real-estate/location";

describe("toShortLocation", () => {
  it("都道府県+市区町村までに切り、番地以降を落とす", () => {
    expect(toShortLocation("東京都渋谷区神南1-2-3")).toBe("東京都渋谷区");
    expect(toShortLocation("神奈川県横浜市中区本町4-5-6")).toBe("神奈川県横浜市");
    expect(toShortLocation("北海道札幌市北区北七条西1-1")).toBe("北海道札幌市");
    expect(toShortLocation("京都府宇治市宇治1-1")).toBe("京都府宇治市");
  });

  it("市区町村名そのものに「市」を含む住所でも地名の途中で切らない", () => {
    expect(toShortLocation("千葉県市川市八幡7-8-9")).toBe("千葉県市川市");
    expect(toShortLocation("三重県四日市市諏訪町1-1")).toBe("三重県四日市市");
  });

  it("郡下の町村も市区町村として扱う", () => {
    expect(toShortLocation("長野県北佐久郡軽井沢町長倉123")).toBe("長野県北佐久郡軽井沢町");
  });

  it("市区町村までしか無い住所はそのまま返す", () => {
    expect(toShortLocation("東京都渋谷区")).toBe("東京都渋谷区");
  });

  it("想定した形に当てはまらない住所は削らずに返す", () => {
    expect(toShortLocation("1600 Pennsylvania Ave NW, Washington")).toBe(
      "1600 Pennsylvania Ave NW, Washington",
    );
    expect(toShortLocation("  渋谷区神南1-2-3  ")).toBe("渋谷区神南1-2-3");
  });
});
