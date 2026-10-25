// ============================================================
// notes.js
// 音当てアプリで使う「音」のデータをまとめたファイル
// - 画面の下に並べる7つの答えのボタン（ド〜シ）
// - 次のステップで、出題する音（ソ3〜ド6）のリストもここに追加する
// ============================================================

// モードのカードに出すアイコン（Svelte の部品）
import NoteIcon from "./icons/NoteIcon.svelte";
import SpeakerIcon from "./icons/SpeakerIcon.svelte";

// ------------------------------------------------------------
// 型の説明（JSDoc）
// VSCode が「この変数にはどんな形のデータが入るか」を理解できるように書いておく
// （書かないと「型が暗黙的に any になります」という赤い波線が出る）
// ------------------------------------------------------------

/**
 * 答えのボタン1つ分のデータ
 * @typedef {object} NoteButton
 * @property {string} id     プログラムの中で使う名前（"C" など）
 * @property {string} name   ボタンに大きく出すドレミの名前（"ド" など）
 * @property {string} letter ボタンに小さく出す英語の音名（"C" など）
 */

/**
 * 遊び方（モード）1つ分のデータ
 * @typedef {object} Mode
 * @property {string} id    URL に使う名前（"read" など）
 * @property {string} title 画面に出す名前（"読む" など）
 * @property {string} desc  ホームに出す短い説明
 * @property {import("svelte").Component<{ size?: number }>} icon ホームのカードに出すアイコンの部品
 */

// ------------------------------------------------------------
// NOTE_BUTTONS
// 画面の下に並べる答えのボタンの一覧（左から右の順）
//   id     : プログラムの中で使う名前（英語の音名。正解の判定に使う）
//   name   : ボタンに大きく出すドレミの名前
//   letter : ボタンに小さく出す英語の音名
// ------------------------------------------------------------
/** @type {NoteButton[]} */
export const NOTE_BUTTONS = [
  { id: "C", name: "ド", letter: "C" },
  { id: "D", name: "レ", letter: "D" },
  { id: "E", name: "ミ", letter: "E" },
  { id: "F", name: "ファ", letter: "F" },
  { id: "G", name: "ソ", letter: "G" },
  { id: "A", name: "ラ", letter: "A" },
  { id: "B", name: "シ", letter: "B" },
];

// ------------------------------------------------------------
// MODES
// 遊び方（モード）の一覧
//   id    : URL に使う名前（/play/read、/play/listen）
//   title : 画面に出す名前
//   desc  : ホームに出す短い説明
//   icon  : ホームのカードに出すアイコン（Svelte の部品をそのまま入れておく）
// ------------------------------------------------------------
/** @type {Mode[]} */
export const MODES = [
  { id: "read", title: "読む", desc: "五線譜の音符を見て答える", icon: NoteIcon },
  { id: "listen", title: "聴く", desc: "鳴った音を聴いて答える", icon: SpeakerIcon },
];

// ------------------------------------------------------------
// findMode(id)
// モードの id（"read" や "listen"）から、そのモードの情報を探して返す関数
// 見つからないとき（URL がまちがっているときなど）は null を返す
// ------------------------------------------------------------
/**
 * @param {string | undefined} id 探したいモードの id（URL から取るので、ないこともある）
 * @returns {Mode | null} 見つかったモード（見つからなければ null）
 */
export function findMode(id) {
  return MODES.find((mode) => mode.id === id) ?? null;
}
