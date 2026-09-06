import { describe, expect, it } from "vitest";

import { formatOklch, resolveInGamutChroma } from "@/lib/color/oklch";

/**
 * OKLCH→sRGBの色域合わせ(`src/lib/color/oklch.ts`)。
 *
 * 費目別支出の円グラフ(B1)が色を実行時に作るために使う([B1-18](https://trello.com/c/UTWWqbpy))。
 * 色域の外の値をそのままCSSへ出すとブラウザが暗黙に丸め、等間隔に取ったはずの色相が
 * 隣同士で潰れることがあるため、ここで収めてから文字列にする。
 */

/** OKLab→線形sRGB。実装と同じ行列を使うので、ここでの検証は「実装が色域の判定に使う値」の追認になる */
const toLinearSrgb = (lightness: number, chroma: number, hue: number): number[] => {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const isInGamut = (lightness: number, chroma: number, hue: number): boolean =>
  toLinearSrgb(lightness, chroma, hue).every((channel) => channel >= -1e-3 && channel <= 1 + 1e-3);

describe("resolveInGamutChroma", () => {
  /** 赤(24.9度)は既存パレットの彩度でもsRGBに収まる。収まる色相まで落とさない */
  it("そのままsRGBに収まる色相では、渡した彩度をそのまま返す", () => {
    expect(resolveInGamutChroma(0.623, 24.9, 0.165)).toBe(0.165);
  });

  /**
   * シアン〜青緑(180度前後)は明度を固定したままだと既存パレットの彩度に届かない。
   * **ここを落とさずにCSSへ出すのがブラウザ任せの丸めを招く経路**なので、落ちること自体を固定する
   */
  it("収まらない色相では彩度を落とし、落とした先はsRGBに収まる", () => {
    const chroma = resolveInGamutChroma(0.623, 184.9, 0.165);

    expect(chroma).toBeLessThan(0.165);
    expect(isInGamut(0.623, chroma, 184.9)).toBe(true);
  });

  /**
   * 色相環を1周して、どの角度でも色域に収まること。**費目の件数は実行時にしか決まらない**ので、
   * 特定の件数で確かめても通らなかった角度が後から現れうる
   */
  it("どの色相でも色域に収まる値を返す", () => {
    for (let hue = 0; hue < 360; hue += 1) {
      const chroma = resolveInGamutChroma(0.623, hue, 0.165);

      expect(isInGamut(0.623, chroma, hue)).toBe(true);
      expect(chroma).toBeGreaterThan(0);
    }
  });

  /** 彩度だけを落とす。色相と明度は動かさない(等間隔の前提と、円グラフ内の明るさの揃いを保つため) */
  it("落とすのは彩度だけで、上限を超えて返すことはない", () => {
    for (let hue = 0; hue < 360; hue += 15) {
      expect(resolveInGamutChroma(0.623, hue, 0.165)).toBeLessThanOrEqual(0.165);
    }
  });
});

describe("formatOklch", () => {
  it("CSSのoklch()の形にする", () => {
    expect(formatOklch(0.623, 0.165, 24.9)).toBe("oklch(0.623 0.165 24.9)");
  });

  /** 桁を切るのはsRGBの階調(1/255)に載らない精度を持ち回らないため。テストが値を突き合わせられる意味もある */
  it("明度・彩度は小数3桁、色相は小数1桁で切る", () => {
    expect(formatOklch(0.6234567, 0.1654321, 24.87654)).toBe("oklch(0.623 0.165 24.9)");
  });
});
