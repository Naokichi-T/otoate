// ============================================================
// sound.js
// 「聴く」モードの音を鳴らすためのファイル
// - 音の高さ：ピタゴラス音律、基準はラ4 ＝ 442Hz
// - 音色：のこぎり波を、高い成分をけずってやわらかくした音（violin-pitch と同じ考え方）
// - 新しい音を鳴らすときは、前の音を止めてから鳴らす（音が重ならないように）
//
// ブラウザで音を出す仕組み（Web Audio API）の流れ
//   発振器（のこぎり波）→ フィルター（高い音をけずる）→ 音量の調整 → スピーカー
// ============================================================

// ------------------------------------------------------------
// 音の決まり
// ------------------------------------------------------------
export const REFERENCE_FREQUENCY = 442; // 基準のラ4 の周波数（Hz）
export const TONE_SECONDS = 2; // 1つの音の長さ（秒）。短くしたいときはここを変える
const VOLUME = 0.25; // 音の大きさ（0〜1。大きすぎると音が割れるので控えめに）
const ATTACK_SECONDS = 0.02; // 鳴り始めに音量を上げる時間（いきなり鳴らすと「プツッ」と雑音が出るため）
const FILTER_FREQUENCY = 2000; // これより高い成分をけずって、やわらかい音にする（Hz）
const STOP_FADE_SECONDS = 0.03; // 前の音を止めるときに音量を下げる時間
const RELEASE_SECONDS = 0.08; // 鳴り終わりに音量を下げる時間（いきなり切ると「プツッ」と雑音が出るため）

// ------------------------------------------------------------
// FIFTHS_FROM_A
// それぞれの音名が、ラから純正5度（周波数 3/2 倍）をいくつたどった音か
// マイナスは下へたどる（ラ → レ → ソ → ド → ファ）、プラスは上へたどる（ラ → ミ → シ）
// ------------------------------------------------------------
/** @type {Record<string, number>} */
const FIFTHS_FROM_A = { F: -4, C: -3, G: -2, D: -1, A: 0, E: 1, B: 2 };

// 平均律でのド からの半音の数（オクターブを決めるための目安に使う）
/** @type {Record<string, number>} */
const SEMITONES_FROM_C = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// ------------------------------------------------------------
// noteFrequency(note)
// 音（ソ3、ミ5 など）のピタゴラス音律での周波数を計算する関数
//
// 計算のしかた
//   1. ラ4（442Hz）から純正5度を、音名ごとの数だけたどる（3/2 を何回かけるか）
//   2. そのままだと高すぎたり低すぎたりするので、2倍・半分でオクターブを合わせる
//      合わせる先は、平均律で計算したおおよその高さにいちばん近いオクターブ
// 例：ド4 → 442 ÷ (3/2)³ ＝ 130.96 → 2倍して 261.9Hz
// ------------------------------------------------------------
/**
 * @param {import("./notes.js").QuizNote} note 音
 * @returns {number} 周波数（Hz）
 */
export function noteFrequency(note) {
  // 1. ラ4 から5度をたどった高さ
  const fifths = FIFTHS_FROM_A[note.letter];
  const chainFrequency = REFERENCE_FREQUENCY * Math.pow(3 / 2, fifths);

  // 平均律でのおおよその高さ（MIDI の番号を使う。ラ4 ＝ 69）
  const midi = 12 * (note.octave + 1) + SEMITONES_FROM_C[note.letter];
  const roughFrequency = REFERENCE_FREQUENCY * Math.pow(2, (midi - 69) / 12);

  // 2. 何オクターブずらせば、おおよその高さにいちばん近くなるか
  const octaveShift = Math.round(Math.log2(roughFrequency / chainFrequency));
  return chainFrequency * Math.pow(2, octaveShift);
}

// ------------------------------------------------------------
// 鳴らしている音の情報（止めるときのために覚えておく）
// ------------------------------------------------------------
/** @type {AudioContext | null} */
let audioContext = null; // 音を出す仕組みの本体（アプリで1つだけ作る）
/** @type {{ oscillator: OscillatorNode, gain: GainNode } | null} */
let currentVoice = null; // 今鳴っている音

// ------------------------------------------------------------
// unlockAudio()
// 音を出せるように準備する関数
// スマホのブラウザは、画面を触ったとき（ボタンを押したときなど）に準備しないと音が出ないので、
// 「スタート」ボタンを押したときに呼ぶ
// ------------------------------------------------------------
export function unlockAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // 止まっている（suspended）ときは動かす
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

// ------------------------------------------------------------
// stopTone()
// 今鳴っている音を、すばやく小さくしてから止める関数
// ------------------------------------------------------------
export function stopTone() {
  if (!audioContext || !currentVoice) return;
  const now = audioContext.currentTime;
  const { oscillator, gain } = currentVoice;

  // 今の音量から 0 に向けて、すばやく下げる（いきなり止めると「プツッ」と雑音が出るため）
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
  oscillator.stop(now + STOP_FADE_SECONDS);

  currentVoice = null;
}

// ------------------------------------------------------------
// playFrequency(frequency)
// 周波数を指定して、1つの音を鳴らす関数（前の音は止める）
// 音量は、鳴り始めにすっと上がり、TONE_SECONDS 秒のあいだ同じ大きさのまま鳴り続け、
// 最後の一瞬（RELEASE_SECONDS）だけ下げて止める
// （だんだん小さくすると、スマホの音量が小さいときに後半が聞こえなくなるため）
// ------------------------------------------------------------
/**
 * @param {number} frequency 鳴らす音の周波数（Hz）
 */
export function playFrequency(frequency) {
  unlockAudio();
  if (!audioContext) return;
  stopTone(); // 前の音が鳴っていたら止める

  const now = audioContext.currentTime;

  // 発振器：のこぎり波
  const oscillator = audioContext.createOscillator();
  oscillator.type = "sawtooth";
  oscillator.frequency.value = frequency;

  // フィルター：高い成分をけずって、やわらかい音にする
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = FILTER_FREQUENCY;

  // 音量の変化
  //   0 秒 … 0 から VOLUME まで ATTACK_SECONDS で上げる
  //   そのあと … VOLUME のまま（同じ大きさで鳴り続ける）
  //   終わりの RELEASE_SECONDS … VOLUME から 0 まで下げる
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(VOLUME, now + ATTACK_SECONDS);
  gain.gain.setValueAtTime(VOLUME, now + TONE_SECONDS - RELEASE_SECONDS);
  gain.gain.linearRampToValueAtTime(0, now + TONE_SECONDS);

  // つなぐ：発振器 → フィルター → 音量 → スピーカー
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + TONE_SECONDS);

  currentVoice = { oscillator, gain };

  // 鳴り終わったら、覚えている音の情報を消す（別の音に置きかわっていなければ）
  oscillator.onended = () => {
    if (currentVoice?.oscillator === oscillator) currentVoice = null;
  };
}

// ------------------------------------------------------------
// playNote(note)
// 音（QuizNote）を、ピタゴラス音律の高さで鳴らす関数
// ------------------------------------------------------------
/**
 * @param {import("./notes.js").QuizNote} note 鳴らす音
 */
export function playNote(note) {
  playFrequency(noteFrequency(note));
}

// ------------------------------------------------------------
// playReference()
// 基準のラ（ラ4 ＝ 442Hz）を鳴らす関数
// ------------------------------------------------------------
export function playReference() {
  playFrequency(REFERENCE_FREQUENCY);
}
