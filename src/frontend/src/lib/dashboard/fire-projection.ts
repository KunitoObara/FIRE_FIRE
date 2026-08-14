import { addMonths, format, startOfMonth } from "date-fns";

import { STORED_DATE_FORMAT } from "@/constants/csv-import";
import { PROJECTION_MAX_MONTHS } from "@/constants/dashboard";
import {
  pickAxisAmountsByType,
  resolveAxisDebts,
  resolveAxisProperties,
  sumDebtBalance,
  sumPropertyAmount,
} from "@/lib/dashboard/aggregation";

/**
 * FIRE到達予測の算出(**正本: docs/screen-requirements-fire-goal.md「到達予測日の算出」**)。
 *
 * 入力は3画面に分かれる — 目標資産額・対象分類・毎月の積立額はB8、資産種別ごとの想定利回りは
 * B9、資産残高・物件・負債はB2/B5〜B7/B11。表示するのはB1だが、算出方式の正本は上の節にある。
 *
 * 起点は当月とし、月単位で先へ進める。表示が「2033年4月頃」の粒度である以上、日単位まで
 * 刻む意味が無い。
 */

/**
 * 年率(%)を月次の成長率に直す。**`(1 + 年率 ÷ 100) ^ (1/12)`**(正本の式)。
 *
 * 年1回の複利ではなく月次にするのは、積立が毎月入るためと、答えを月単位で出すためである。
 * 単利は採らない(長期の予測で実態から離れが大きくなる)。
 *
 * **想定利回りが未設定(`null`)の資産種別は年率0%として扱い、予測から除外しない。**
 * その残高は現在資産額に入っており、除外すると予測の初月が現在資産額と食い違う(正本)。
 *
 * 年率-100%以下は成長率を0にする。`(1 + 年率 ÷ 100)`が負になると分数のべき乗が`NaN`になり、
 * 以降の合計が丸ごと数値でなくなるため。B9は絶対値100%以内しか保存できない
 * (docs/screen-requirements-fire-goal.md B9)ので通常は-100%が下限で、そこは0(資産が
 * 1年で消える想定)に落ちる。
 */
export const toMonthlyGrowthRate = (annualReturnPercent: number | null): number => {
  const base = 1 + (annualReturnPercent ?? 0) / 100;

  return base <= 0 ? 0 : base ** (1 / 12);
};

/**
 * 予測の出発点を、対象分類の解決結果と直近の資産残高から組み立てる。
 *
 * **成長させる分(`balancesByType`)と据え置く分(`flatAmount`)に分ける。**
 *
 * - 据え置くのは対象の物件の額(利ざや または 時価)と負債の残債。物件の時価は手動更新が
 *   前提で、負債は「自動計算は行わない」(要件定義書 4.5 / 4.8)ため、どちらにも利回りを
 *   当てられない
 * - **既定(総資産)のときは、CSVの「合計(円)」と資産種別の内訳の差額も据え置く。** 既定の
 *   現在資産額はCSVの合計をそのまま採る決まりで、合計には資産種別の列に現れない額が
 *   含まれうる。何の資産か分からない額に利回りを当てない
 *
 * この分け方により、**予測の初月は必ず現在資産額(`resolveAchievementAmount`)と一致する**。
 * 一致しなくなったら上のどれかが崩れている印なので、テストで検算している。
 *
 * 資産残高が未取込のときは出発点を0円にする。現在資産額も0円として扱う決まりで
 * (docs/screen-requirements-dashboard.md B1)、そこから積立額だけで進めば到達月は求まる。
 */
export const resolveProjectionBase = (
  resolution: AchievementAxisResolution,
  latest: AssetSnapshot | undefined,
  debts: Debt[],
  properties: RealEstateProperty[],
): FireProjectionBase => {
  if (latest === undefined) {
    return { balancesByType: {}, flatAmount: 0 };
  }

  if (resolution.assetTypeNames === null) {
    const byTypeTotal = Object.values(latest.byType).reduce((sum, amount) => sum + amount, 0);

    return { balancesByType: latest.byType, flatAmount: latest.total - byTypeTotal };
  }

  const axisProperties = resolveAxisProperties(properties, resolution.propertyValuations);

  return {
    balancesByType: pickAxisAmountsByType(latest, resolution.assetTypeNames),
    flatAmount:
      sumPropertyAmount(axisProperties, resolution.propertyValuations) -
      sumDebtBalance(resolveAxisDebts(debts, resolution.debtIds)),
  };
};

/** 合計は据え置き分も含めて出す。予測の各月で同じ足し方をする */
const sumProjectedTotal = (balances: number[], flatAmount: number, contributed: number): number =>
  balances.reduce((sum, amount) => sum + amount, 0) + flatAmount + contributed;

/**
 * 到達予測を算出する。結果は「到達予測日」「達成済み」「到達見込みなし」の**3つ**
 * (正本「結果の区別」)。「目標に達する月」と「設定した結果として届かない」を同じ空欄で
 * 表すと区別が付かないため、届かないことも状態として返す。
 *
 * 手順は月ごとに次の3つを繰り返す。
 *
 * 1. 資産種別ごとに、その残高へ月次の成長率を掛ける
 * 2. 積立額を加える。**積立額には利回りを掛けない** — 積んだ分がどの資産種別に入るかを
 *    尋ねる欄が無く、推測で利回りの高い資産種別に積むと予測が楽観へ倒れる。据え置きの
 *    現金として積み上がる扱いにする(実際より遅く出る方向であり、外すなら安全な側)
 * 3. 合計が目標資産額に達したかを見る
 *
 * **「到達見込みなし」は打ち切り月まで回した結果そのものとして返す。** 「利回りが全て未設定で
 * 積立も0以下」のような条件で早期に倒さない — 正の利回り・正の積立でも目標額が大きければ
 * 届かないため、条件判定に置き換えるとそのケースを取り落とす(正本)。
 *
 * **打ち切りの月ちょうどで届いた場合は到達側に倒す。** 打ち切りは「ここまで進めても届かない」
 * ことを見込みなしと呼ぶための線であって、届いた月を捨てるためのものではない。
 */
export const buildFireProjection = ({
  targetAmount,
  balancesByType,
  flatAmount,
  monthlyContribution,
  assumptions,
  now,
}: FireProjectionInput): FireProjection => {
  const assetTypeNames = Object.keys(balancesByType);
  /*
    月次の成長率は資産種別ごとに1度だけ求める。ループの中でべき乗を計算すると、
    打ち切りまで回したときに資産種別数 × 600 回の計算になる
  */
  const rates = assetTypeNames.map((assetTypeName) =>
    toMonthlyGrowthRate(assumptions[assetTypeName]?.expectedReturn ?? null),
  );
  /** 資産種別ごとの残高。並びは`rates`と対応する */
  let balances = assetTypeNames.map((assetTypeName) => balancesByType[assetTypeName] ?? 0);

  // 現在資産額が既に目標以上なら、過去日付や0ヶ月を出さずに「達成済み」へ倒す(正本)
  if (sumProjectedTotal(balances, flatAmount, 0) >= targetAmount) {
    return { status: "achieved" };
  }

  /** 積み上がった積立の累計。利回りを掛けないので残高とは別に持つ */
  let contributed = 0;

  for (let month = 1; month <= PROJECTION_MAX_MONTHS; month += 1) {
    balances = balances.map((amount, index) => amount * (rates[index] ?? 1));
    contributed += monthlyContribution;

    if (sumProjectedTotal(balances, flatAmount, contributed) >= targetAmount) {
      return {
        status: "projected",
        /*
          日付は月初にする。表示は「2033年4月頃」の粒度で日を出さないが、月末日を起点に
          `addMonths`すると月の長さによって日がずれ、同じ「2033年4月」を指す値が複数できる
        */
        achievementDate: format(startOfMonth(addMonths(now, month)), STORED_DATE_FORMAT),
      };
    }
  }

  return { status: "unreachable" };
};
