// ============================================================
// notes.js
// 音当てアプリで使う「音」のデータをまとめたファイル
// - 画面の下に並べる7つの答えのボタン（ド〜シ）
// - 出題する音（ソ3〜ド6）のリストと、次の問題を選ぶ関数
// - 遊び方（モード）と、モードごとのレベルの一覧
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
 * @property {Level[]} levels このモードのレベルの一覧（やさしい順）
 */

/**
 * レベル1つ分のデータ
 * @typedef {object} Level
 * @property {number} id        レベルの番号（1、2、3）。URL にも使う（/play/read/1）
 * @property {string} label     画面に出す名前（"Lv1" など）
 * @property {string} desc      ホームの Lv ボタンに出す短い説明
 * @property {QuizNote[]} notes このレベルで出題する音のリスト
 * @property {boolean} reference 基準のラを鳴らすか（「聴く」で使う。ステップ6で音を鳴らす）
 */

/**
 * 出題する音1つ分のデータ
 * @typedef {object} QuizNote
 * @property {string} id     音の名前（"G3"、"C6" など。英語の音名＋オクターブの数字）
 * @property {string} letter 英語の音名（"G" など）。答えのボタンの id と同じ
 * @property {number} octave オクターブの数字（ド4 ＝ 真ん中のド。ドから上がるたびに数字が変わる）
 * @property {number} step   ド0 から数えて、白鍵で何個目の音か（五線譜の上の高さを決めるのに使う）
 * @property {string} label  画面に出す名前（"ソ3" など）
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
// LETTERS
// 英語の音名を、ドから順に並べたもの（C=0、D=1 … B=6 の番号として使う）
// ------------------------------------------------------------
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

// ------------------------------------------------------------
// toStep(letter, octave)
// 音名とオクターブから「ド0 から数えて白鍵で何個目か」を計算する関数
// 例：ド4（C4）→ 4 × 7 ＋ 0 ＝ 28、ソ3（G3）→ 3 × 7 ＋ 4 ＝ 25
// この数が1つ増えると、五線譜の上で半間（線と間の1つ分）上がる
// ------------------------------------------------------------
/**
 * @param {string} letter 英語の音名（"C"〜"B"）
 * @param {number} octave オクターブの数字
 * @returns {number} ド0 から数えた白鍵の番号
 */
export function toStep(letter, octave) {
  return octave * 7 + LETTERS.indexOf(letter);
}

// ------------------------------------------------------------
// makeNoteRange(fromId, toId)
// 「ソ3 から ド6 まで」のように、2つの音のあいだの白鍵の音を
// 低いほうから順に全部並べたリストを作る関数
// ------------------------------------------------------------
/**
 * @param {string} fromId いちばん低い音（"G3" など）
 * @param {string} toId   いちばん高い音（"C6" など）
 * @returns {QuizNote[]} 低い順に並んだ音のリスト
 */
function makeNoteRange(fromId, toId) {
  // "G3" → 音名 "G" とオクターブ 3 に分けて、白鍵の番号にする
  const from = toStep(fromId[0], Number(fromId.slice(1)));
  const to = toStep(toId[0], Number(toId.slice(1)));

  /** @type {QuizNote[]} */
  const list = [];
  for (let step = from; step <= to; step++) {
    const letter = LETTERS[step % 7]; // 7で割った余りが音名の番号
    const octave = Math.floor(step / 7); // 7で割った商がオクターブ
    // ドレミの名前は答えのボタンの一覧から探す
    const name = NOTE_BUTTONS.find((b) => b.id === letter)?.name ?? letter;
    list.push({ id: `${letter}${octave}`, letter, octave, step, label: `${name}${octave}` });
  }
  return list;
}

// ------------------------------------------------------------
// ALL_NOTES
// 出題する音の全部（ソ3〜ド6 の白鍵の18音）
// ステップ5でレベルを作るときは、ここから使う音をしぼり込む
// ------------------------------------------------------------
export const ALL_NOTES = makeNoteRange("G3", "C6");

// ------------------------------------------------------------
// pickNotes(ids)
// "G3" のような音の名前のリストから、ALL_NOTES の中の音を取り出す関数
// （とびとびの音を選びたいときに使う。例：「聴く」Lv1 の開放弦まわりの音）
// ------------------------------------------------------------
/**
 * @param {string[]} ids 取り出したい音の名前のリスト
 * @returns {QuizNote[]} 取り出した音のリスト（ids の順）
 */
function pickNotes(ids) {
  return (
    ids
      .map((id) => ALL_NOTES.find((n) => n.id === id))
      // 見つからなかった名前（undefined）は取りのぞく
      // 「@type」は、取りのぞいたあとは QuizNote だけになることを VSCode に教えるための書き方
      .filter(/** @type {(n: QuizNote | undefined) => n is QuizNote} */ ((n) => n !== undefined))
  );
}

// ------------------------------------------------------------
// READ_LEVELS
// 「読む」モードのレベル
//   Lv1 … 五線の中の音だけ（ミ4〜ファ5、9音：線の5音＋間の4音）
//   Lv2 … 加線の音もあり（ソ3〜ド6、18音）
// ------------------------------------------------------------
/** @type {Level[]} */
const READ_LEVELS = [
  { id: 1, label: "Lv1", desc: "五線の中", notes: makeNoteRange("E4", "F5"), reference: false },
  { id: 2, label: "Lv2", desc: "加線あり", notes: ALL_NOTES, reference: false },
];

// ------------------------------------------------------------
// LISTEN_LEVELS
// 「聴く」モードのレベル（音を鳴らすのはステップ6）
//   Lv1 … 開放弦（ソ3・レ4・ラ4・ミ5）と、各弦の1つ上の音（ラ3・ミ4・シ4・ファ5）の8音、基準のラあり
//   Lv2 … ソ3〜ド6 の全部、基準のラあり
//   Lv3 … ソ3〜ド6 の全部、基準のラなし
// ------------------------------------------------------------
/** @type {Level[]} */
const LISTEN_LEVELS = [
  {
    id: 1,
    label: "Lv1",
    desc: "開放弦まわり",
    notes: pickNotes(["G3", "A3", "D4", "E4", "A4", "B4", "E5", "F5"]),
    reference: true,
  },
  { id: 2, label: "Lv2", desc: "全部の音", notes: ALL_NOTES, reference: true },
  { id: 3, label: "Lv3", desc: "基準なし", notes: ALL_NOTES, reference: false },
];

// ------------------------------------------------------------
// pickNextNote(notes, prev, minDistance)
// 次の問題の音を、リストの中からランダムに1つ選ぶ関数
// 直前の音（prev）から minDistance 個以上はなれた音だけを選ぶ（白鍵で数える）
//   minDistance = 1 … 直前と同じ音だけ出さない（となりの音は出る）
//   minDistance = 2 … 直前と同じ音と、そのとなり（1音差）の音を出さない
//                     例：直前がミ4 なら、レ4・ミ4・ファ4 は出ない
// （同じ音が続くと押しまちがいに見え、1音差だと五線譜の上で場所がほとんど変わらず簡単になるため）
// ------------------------------------------------------------
/**
 * @param {QuizNote[]} notes 選ぶもとになる音のリスト
 * @param {QuizNote | null} prev 直前の問題の音（最初の問題なら null）
 * @param {number} [minDistance] 直前の音から何個以上はなれた音を選ぶか（指定しなければ 1）
 * @returns {QuizNote} 選んだ音
 */
export function pickNextNote(notes, prev, minDistance = 1) {
  // 直前の音から minDistance 個以上はなれた音だけを候補にする
  // Math.abs(…) … 差の大きさ（上でも下でも同じように数えるため、マイナスを取る）
  let candidates = notes.filter((n) => !prev || Math.abs(n.step - prev.step) >= minDistance);

  // 候補が1つもないとき（音の数が少ないときなど）は、直前と同じ音だけ取りのぞく
  if (candidates.length === 0) {
    candidates = notes.filter((n) => n.id !== prev?.id);
  }
  // それでも空なら（音が1つしかないとき）、全部から選ぶ
  if (candidates.length === 0) {
    candidates = notes;
  }

  // 0 〜 候補の数−1 のどれかの番号をランダムに選ぶ
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

// ------------------------------------------------------------
// MODES
// 遊び方（モード）の一覧
//   id    : URL に使う名前（/play/read、/play/listen）
//   title : 画面に出す名前
//   desc  : ホームに出す短い説明
//   icon  : ホームのカードに出すアイコン（Svelte の部品をそのまま入れておく）
//   levels: このモードのレベルの一覧
// ------------------------------------------------------------
/** @type {Mode[]} */
export const MODES = [
  { id: "read", title: "読む", desc: "五線譜の音符を見て答える", icon: NoteIcon, levels: READ_LEVELS },
  { id: "listen", title: "聴く", desc: "鳴った音を聴いて答える", icon: SpeakerIcon, levels: LISTEN_LEVELS },
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

// ------------------------------------------------------------
// findLevel(mode, id)
// モードの中から、URL のレベルの番号（"1" などの文字）に合うレベルを探して返す関数
// 見つからないとき（/play/read/9 など）は null を返す
// ------------------------------------------------------------
/**
 * @param {Mode} mode モードの情報
 * @param {string | undefined} id URL から取ったレベルの番号（文字）
 * @returns {Level | null} 見つかったレベル（見つからなければ null）
 */
export function findLevel(mode, id) {
  return mode.levels.find((level) => String(level.id) === id) ?? null;
}
