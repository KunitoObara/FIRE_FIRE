import { config } from "@fortawesome/fontawesome-svg-core";

/**
 * FontAwesomeが実行時に`<style>`をheadへ注入する挙動を止める。
 * CSSは`src/app/layout.tsx`で静的に読み込んでおり、注入させると
 * SSRで返したHTMLとクライアントの描画が一瞬ずれる(アイコンが巨大に見える)。
 *
 * アイコンを使うクライアントコンポーネントから副作用importで読み込む。
 */
config.autoAddCss = false;
