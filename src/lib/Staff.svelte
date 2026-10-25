<!--
	Staff.svelte
	五線譜に「ト音記号」と「音符1つ」を描く部品（SVG）
	- ト音記号と符頭（音符の黒い丸）は楽譜用フォント Bravura の文字で描く
	- 五線・加線・棒（符幹）は SVG の線で描く
	- 音の高さは note.step（ド0 から数えた白鍵の番号）で決まる

	使い方の例：<Staff note={currentNote} />
-->
<script>
  // note … 描く音（notes.js の QuizNote）。null のときは五線とト音記号だけ描く
  /** @type {{ note: import("./notes.js").QuizNote | null }} */
  let { note } = $props();

  // ------------------------------------------------------------
  // 大きさの決まり
  // SP（スペース）＝ 五線の線と線のあいだの幅。すべての大きさをこれの何倍かで決める
  // （楽譜用フォントは「1文字の大きさ ＝ 4スペース」で作られている）
  // ------------------------------------------------------------
  const SP = 10;
  const FONT_SIZE = SP * 4;

  // SVG 全体の大きさ（viewBox の座標で。実際の画面の大きさは CSS で決まる）
  const WIDTH = SP * 16;
  const HEIGHT = SP * 12;

  // 第1線（いちばん下の線）の y 座標
  // ド6 の上の加線と、ソ3 の下の加線の両方が入るように、少し下寄りに置く
  const BOTTOM_Y = SP * 7.75;

  // 第1線の音（ミ4）の白鍵の番号。ここを基準に音の高さを計算する
  const BOTTOM_STEP = 4 * 7 + 2; // ミ4 ＝ 30
  // 第5線（いちばん上の線）の音（ファ5）の白鍵の番号
  const TOP_STEP = BOTTOM_STEP + 8; // ファ5 ＝ 38
  // 第3線（真ん中の線）の音（シ4）。これより下は棒が上向き、これから上は下向き
  const MIDDLE_STEP = BOTTOM_STEP + 4; // シ4 ＝ 34

  // ト音記号と音符の横の位置
  const CLEF_X = SP * 1;
  const NOTE_X = SP * 9;

  // 楽譜用フォント Bravura の文字（SMuFL という決まりで番号が決まっている）
  const GLYPH_G_CLEF = ""; // ト音記号
  const GLYPH_NOTEHEAD = ""; // 黒い符頭（四分音符の丸）

  // Bravura の寸法（スペース単位。フォントの説明書きの値）
  const NOTEHEAD_WIDTH = 1.18 * SP; // 符頭の幅
  const STEM_ATTACH_Y = 0.168 * SP; // 符頭のどの高さから棒が出るか
  const STEM_LENGTH = 3.5 * SP; // 棒の長さ（1オクターブ分）
  const STEM_WIDTH = 0.12 * SP; // 棒の太さ
  const STAFF_LINE_WIDTH = 0.13 * SP; // 五線の太さ
  const LEDGER_WIDTH = 0.16 * SP; // 加線の太さ
  const LEDGER_EXTENSION = 0.4 * SP; // 加線が符頭からはみ出す長さ

  // ------------------------------------------------------------
  // stepToY(step)
  // 白鍵の番号から、五線譜の上での y 座標を計算する関数
  // 番号が1つ上がるごとに、半スペース（線→間、間→線）上に上がる
  // ------------------------------------------------------------
  /**
   * @param {number} step 白鍵の番号
   * @returns {number} y 座標（上に行くほど小さい）
   */
  function stepToY(step) {
    return BOTTOM_Y - ((step - BOTTOM_STEP) * SP) / 2;
  }

  // ------------------------------------------------------------
  // getLedgerSteps(step)
  // その音に必要な加線（五線の外の短い線）の高さを、白鍵の番号のリストで返す関数
  // 例：ソ3 → [ド4, ラ3]、ド6 → [ラ5, ド6]、五線の中の音 → []
  // ------------------------------------------------------------
  /**
   * @param {number} step 白鍵の番号
   * @returns {number[]} 加線を引く高さのリスト
   */
  function getLedgerSteps(step) {
    /** @type {number[]} */
    const steps = [];
    // 五線より下：第1線の1つ下の線（ド4）から、2つずつ下へ
    for (let s = BOTTOM_STEP - 2; s >= step; s -= 2) {
      steps.push(s);
    }
    // 五線より上：第5線の1つ上の線（ラ5）から、2つずつ上へ
    for (let s = TOP_STEP + 2; s <= step; s += 2) {
      steps.push(s);
    }
    return steps;
  }

  // 五線の5本の線の y 座標（下から順）
  const staffLines = [0, 1, 2, 3, 4].map((i) => BOTTOM_Y - i * SP);

  // 音符の y 座標（note が変わるたびに計算し直す）
  let noteY = $derived(note ? stepToY(note.step) : 0);

  // 棒が上向きか（真ん中の線より下の音なら上向き）
  let stemUp = $derived(note ? note.step < MIDDLE_STEP : true);

  // 加線の y 座標のリスト
  let ledgerYs = $derived(note ? getLedgerSteps(note.step).map(stepToY) : []);
</script>

<svg class="staff" xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={note ? `五線譜の音符（${note.label}）` : "五線譜"}>
  <!-- 五線（5本の横線） -->
  {#each staffLines as y (y)}
    <line x1={SP * 0.5} x2={WIDTH - SP * 0.5} y1={y} y2={y} stroke-width={STAFF_LINE_WIDTH} />
  {/each}

  <!-- ト音記号（文字の基準の高さを第2線＝ソ4 に合わせる） -->
  <text class="glyph" x={CLEF_X} y={stepToY(BOTTOM_STEP + 2)} font-size={FONT_SIZE}>{GLYPH_G_CLEF}</text>

  {#if note}
    <!-- 加線（五線の外の音のときだけ） -->
    {#each ledgerYs as y (y)}
      <line x1={NOTE_X - LEDGER_EXTENSION} x2={NOTE_X + NOTEHEAD_WIDTH + LEDGER_EXTENSION} y1={y} y2={y} stroke-width={LEDGER_WIDTH} />
    {/each}

    <!-- 棒（符幹）：上向きなら符頭の右はしから上へ、下向きなら左はしから下へ -->
    {#if stemUp}
      <line x1={NOTE_X + NOTEHEAD_WIDTH - STEM_WIDTH / 2} x2={NOTE_X + NOTEHEAD_WIDTH - STEM_WIDTH / 2} y1={noteY - STEM_ATTACH_Y} y2={noteY - STEM_LENGTH} stroke-width={STEM_WIDTH} />
    {:else}
      <line x1={NOTE_X + STEM_WIDTH / 2} x2={NOTE_X + STEM_WIDTH / 2} y1={noteY + STEM_ATTACH_Y} y2={noteY + STEM_LENGTH} stroke-width={STEM_WIDTH} />
    {/if}

    <!-- 符頭（黒い丸） -->
    <text class="glyph" x={NOTE_X} y={noteY} font-size={FONT_SIZE}>{GLYPH_NOTEHEAD}</text>
  {/if}
</svg>

<style>
  /* 五線譜全体：横幅いっぱい（ただし大きくなりすぎないように上限あり） */
  .staff {
    display: block;
    width: 100%;
    max-width: 420px;
    height: auto;
  }

  /* 線はすべてふつうの文字の色 */
  line {
    stroke: var(--ink);
  }

  /* 楽譜用フォントで描く文字（ト音記号・符頭） */
  .glyph {
    font-family: "Bravura";
    fill: var(--ink);
  }
</style>
