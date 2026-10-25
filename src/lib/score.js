// ============================================================
// score.js
// 点数と反応速度の計算をまとめたファイル
// - 1問ごとの点数：10点 ＋ 5秒ゲージの残り秒数 × 2点（最大20点、四捨五入して整数）
// - 平均反応速度：正解したときの反応時間の平均
// 画面（+page.svelte）から計算の決まりを切り離しておくと、
// あとで点数のルールを変えたくなったときに、ここだけ直せばよい
// ============================================================

// ------------------------------------------------------------
// 点数の決まり
// ------------------------------------------------------------
export const BASE_POINTS = 10; // 正解したらもらえる基本の点
export const POINTS_PER_SECOND = 2; // ゲージの残り1秒につき、もらえる点
export const THINK_SECONDS = 5; // 5秒ゲージの長さ（秒）

// ------------------------------------------------------------
// calcPoints(reactionMs)
// 正解までにかかった時間から、その問題の点数を計算する関数
// 例：1.6秒で正解 → ゲージの残り 3.4秒 → 10 ＋ 3.4 × 2 ＝ 16.8 → 四捨五入して 17点
//     5秒以上かかった → ゲージの残り 0秒 → 10点
// ------------------------------------------------------------
/**
 * @param {number} reactionMs 問題が出てから正解を押すまでの時間（ミリ秒）
 * @returns {number} その問題の点数（整数）
 */
export function calcPoints(reactionMs) {
  // ゲージの残り秒数（0 より小さくはならない）
  const remainingSeconds = Math.max(0, THINK_SECONDS - reactionMs / 1000);
  return Math.round(BASE_POINTS + remainingSeconds * POINTS_PER_SECOND);
}

// ------------------------------------------------------------
// averageSeconds(reactionTimes)
// 反応時間（ミリ秒）のリストから、平均を「秒」で計算する関数
// リストが空（正解が0問）のときは null を返す
// ------------------------------------------------------------
/**
 * @param {number[]} reactionTimes 正解したときの反応時間のリスト（ミリ秒）
 * @returns {number | null} 平均の秒数（正解がなければ null）
 */
export function averageSeconds(reactionTimes) {
  if (reactionTimes.length === 0) return null;
  // 全部を足して、数で割る
  const total = reactionTimes.reduce((sum, ms) => sum + ms, 0);
  return total / reactionTimes.length / 1000;
}

// ------------------------------------------------------------
// formatSeconds(seconds)
// 秒数を、画面に出す文字（小数2けた）に変える関数
// null（正解が0問）のときは「—」にする
// 例：1.234 → "1.23"
// ------------------------------------------------------------
/**
 * @param {number | null} seconds 秒数
 * @returns {string} 画面に出す文字
 */
export function formatSeconds(seconds) {
  return seconds === null ? "—" : seconds.toFixed(2);
}
