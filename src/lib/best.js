// ============================================================
// best.js
// 最高スコアを、ブラウザの中（localStorage）に保存・読み込みするファイル
// - 「読む Lv1」「聴く Lv3」のように、モードとレベルの組ごとに1つずつ記録する
// - 保存の形：{ "read-1": 123, "listen-3": 45, … } を文字にして、1つの名前で保存する
// - localStorage が使えないとき（プライベートブラウズなど）は、エラーにせず「記録なし」として動く
// ============================================================

// localStorage に保存するときの名前（ほかのアプリと混ざらないように、アプリ名を付ける）
const STORAGE_KEY = "otoate-best-scores";

// ------------------------------------------------------------
// makeKey(modeId, levelId)
// モードとレベルから、記録の名前（"read-1" など）を作る関数
// ------------------------------------------------------------
/**
 * @param {string} modeId モードの id（"read" など）
 * @param {number} levelId レベルの番号
 * @returns {string} 記録の名前
 */
function makeKey(modeId, levelId) {
  return `${modeId}-${levelId}`;
}

// ------------------------------------------------------------
// loadBestScores()
// 保存してある最高スコアを全部読み込む関数
// まだ何も保存していないとき・読み込めないときは、空の記録 {} を返す
// ------------------------------------------------------------
/**
 * @returns {Record<string, number>} 記録の名前 → 最高スコア
 */
export function loadBestScores() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return {};
    const data = JSON.parse(text); // 文字から元のデータに戻す
    // 形がおかしいとき（手で書き換えられたなど）は、空として扱う
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

// ------------------------------------------------------------
// getBestScore(modeId, levelId)
// あるモード・レベルの最高スコアを返す関数（記録がなければ null）
// ------------------------------------------------------------
/**
 * @param {string} modeId モードの id
 * @param {number} levelId レベルの番号
 * @returns {number | null} 最高スコア（記録がなければ null）
 */
export function getBestScore(modeId, levelId) {
  const value = loadBestScores()[makeKey(modeId, levelId)];
  return typeof value === "number" ? value : null;
}

// ------------------------------------------------------------
// saveBestScore(modeId, levelId, score)
// 今回のスコアが最高スコアより高ければ保存して、true（新記録）を返す関数
// 同じ点・低い点・0点のときは保存せず、false を返す
// ------------------------------------------------------------
/**
 * @param {string} modeId モードの id
 * @param {number} levelId レベルの番号
 * @param {number} score 今回のスコア
 * @returns {boolean} 新記録なら true
 */
export function saveBestScore(modeId, levelId, score) {
  const best = getBestScore(modeId, levelId);
  // 0点は記録しない（1問も正解していないのに「NEW!」と出ないように）
  if (score <= 0 || (best !== null && score <= best)) return false;

  const all = loadBestScores();
  all[makeKey(modeId, levelId)] = score;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); // データを文字にして保存
  } catch {
    // 保存できなかったとき（容量がいっぱい・プライベートブラウズなど）は、あきらめる
  }
  return true;
}
