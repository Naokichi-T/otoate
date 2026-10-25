<!--
	play/[mode]/+page.svelte（ゲーム画面）
	URL の最後の部分でモードが決まる
	  /play/read   … 「読む」モード（五線譜の音符を見て答える）
	  /play/listen … 「聴く」モード（鳴った音を聴いて答える）

	画面の並び
	- 上：やめるリンク・残り時間・スコア（数字はステップ3・4で動かす）
	- その下：5秒ゲージ（ステップ3で動かす）
	- まん中：問題を出す場所（読む＝五線譜と音符、聴く＝もう一度ボタン）
	- 下：ド〜シの7つのボタン

	ステップ2でできること
	- ソ3〜ド6 の中からランダムに問題を出す（直前と同じ音は出さない）
	- 正しいボタン → ボタンが0.2秒緑に光って、すぐ次の問題へ（音符は黒のまま）
	- ちがうボタン → ボタンと音符が0.2秒赤に光って、お手つき＋1（同じ問題のまま）
-->
<script>
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { NOTE_BUTTONS, ALL_NOTES, findMode, pickNextNote } from "../../../lib/notes.js";
  import Staff from "../../../lib/Staff.svelte";
  import SpeakerIcon from "../../../lib/icons/SpeakerIcon.svelte";

  // ボタンが緑・赤に光っている時間（ミリ秒）
  const FLASH_MS = 200;

  // URL の [mode] の部分から、今のモードの情報を探す
  // まちがった URL（/play/abc など）のときは null になる
  let mode = $derived(findMode(page.params.mode));

  // 今の問題の音（最初はまだ決まっていないので null）
  /** @type {import("../../../lib/notes.js").QuizNote | null} */
  let currentNote = $state(null);

  // 正解した数とお手つきの数（ステップ4で、スコアや結果画面に使う）
  let correctCount = $state(0);
  let missCount = $state(0);

  // 光らせているボタン
  //   id   : 光らせるボタンの id（"C" など）
  //   kind : "ok"（正解・緑）か "ng"（お手つき・赤）
  /** @type {{ id: string, kind: "ok" | "ng" } | null} */
  let flash = $state(null);

  // 光を消すタイマーの番号（続けて押されたとき、前のタイマーを止めるために覚えておく）
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let flashTimer;

  // ------------------------------------------------------------
  // nextQuestion()
  // 次の問題の音を選んで、画面に出す関数
  // ------------------------------------------------------------
  function nextQuestion() {
    currentNote = pickNextNote(ALL_NOTES, currentNote);
  }

  // ------------------------------------------------------------
  // showFlash(id, kind)
  // 押したボタンを、少しのあいだ緑（正解）か赤（お手つき）に光らせる関数
  // お手つきのときは、五線譜の音符も同じあいだ赤になる（画面側で flash を見て色を付ける）
  // ------------------------------------------------------------
  /**
   * @param {string} id 光らせるボタンの id
   * @param {"ok" | "ng"} kind 正解なら "ok"、お手つきなら "ng"
   */
  function showFlash(id, kind) {
    clearTimeout(flashTimer); // 前の光がまだ残っていたら、そのタイマーは止める
    flash = { id, kind };
    flashTimer = setTimeout(() => {
      flash = null;
    }, FLASH_MS);
  }

  // ------------------------------------------------------------
  // handleAnswer(button)
  // 下のドレミのボタンが押されたときに呼ばれる関数
  // 押したボタンの音名と、今の問題の音名が同じなら正解
  // （オクターブは見ない。ソ3 でも ソ5 でも「ソ」を押せば正解）
  // ------------------------------------------------------------
  /** @param {import("../../../lib/notes.js").NoteButton} button 押されたボタンのデータ */
  function handleAnswer(button) {
    if (!currentNote) return; // 問題がまだ出ていないときは何もしない

    if (button.id === currentNote.letter) {
      // 正解：ボタンだけ緑に光らせて、すぐ次の問題へ（音符は黒のまま）
      correctCount++;
      showFlash(button.id, "ok");
      nextQuestion();
    } else {
      // お手つき：ボタンと音符を赤に光らせて、お手つきを数える（問題はそのまま）
      missCount++;
      showFlash(button.id, "ng");
    }
  }

  // ------------------------------------------------------------
  // handleReplay()
  // 「聴く」モードの「もう一度」ボタンが押されたときに呼ばれる関数
  // ステップ6で、ここに音を鳴らす処理を入れる（今は何もしない）
  // ------------------------------------------------------------
  function handleReplay() {
    // まだ何もしない
  }

  // 画面が表示されたら、最初の問題を出す
  // （ランダムに選ぶので、ブラウザで表示されてから選ぶ）
  onMount(() => {
    nextQuestion();
    // 画面を離れるときに、光を消すタイマーが残っていたら止める
    return () => clearTimeout(flashTimer);
  });
</script>

<svelte:head>
  <title>{mode ? `${mode.title} | 音当て` : "音当て"}</title>
</svelte:head>

{#if mode}
  <main class="game">
    <!-- ===== 上の帯：やめる・残り時間・スコア ===== -->
    <header class="status">
      <a class="quit" href="/">← やめる</a>
      <div class="status-item">
        <span class="status-label">残り</span>
        <span class="status-value">30<small>秒</small></span>
      </div>
      <div class="status-item">
        <span class="status-label">スコア</span>
        <span class="status-value score">0</span>
      </div>
    </header>

    <!-- ===== 5秒ゲージ（ステップ3で動かす。今は満タンのまま） ===== -->
    <div class="gauge" aria-label="残りの考える時間">
      <div class="gauge-fill" style="width: 100%"></div>
    </div>

    <!-- ===== 問題を出す場所 ===== -->
    <section class="question">
      {#if mode.id === "read"}
        <!-- 「読む」：五線譜に今の問題の音符を描く -->
        <!--
					highlight … 音符の色。お手つきでボタンが赤く光っているあいだだけ "ng"（赤）にする
					正解のときはすぐ次の音符に変わるので、色は付けない（黒のまま）
				-->
        <Staff note={currentNote} highlight={flash?.kind === "ng" ? "ng" : null} />
      {:else}
        <!-- 「聴く」：もう一度鳴らすボタン -->
        <button class="replay" type="button" onclick={handleReplay}>
          <SpeakerIcon size={26} />
          <span>もう一度</span>
        </button>
      {/if}

      <!-- 確認用の表示（ステップ4でスコアなどの表示ができたら消す） -->
      <p class="debug">
        （確認用）問題：{currentNote?.label ?? "—"}　正解 {correctCount}　お手つき {missCount}
      </p>
    </section>

    <!-- ===== 下のドレミのボタン（7つを横1列に並べる） ===== -->
    <nav class="answers">
      {#each NOTE_BUTTONS as button (button.id)}
        <!--
					光らせているボタンには、ok（緑）か ng（赤）のクラスを付ける
					class:ok={条件} … 条件が true のときだけ「ok」というクラスが付く
				-->
        <button class="answer" class:ok={flash?.id === button.id && flash?.kind === "ok"} class:ng={flash?.id === button.id && flash?.kind === "ng"} type="button" onclick={() => handleAnswer(button)}>
          <span class="answer-name">{button.name}</span>
          <span class="answer-letter">{button.letter}</span>
        </button>
      {/each}
    </nav>
  </main>
{:else}
  <!-- まちがった URL のとき -->
  <main class="not-found">
    <p>このモードはありません。</p>
    <a href="/">ホームへ戻る</a>
  </main>
{/if}

<style>
  /* ------------------------------------------------------------
	   画面全体：上から「帯・ゲージ・問題・ボタン」を縦に並べ、
	   問題の場所が残りの高さをいっぱいに使う
	   100dvh … スマホのアドレスバーの出入りに合わせた画面の高さ
	   ------------------------------------------------------------ */
  .game {
    height: 100dvh;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    /* iPhone の下のバー（ホームインジケーター）にボタンが重ならないようにする */
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* ===== 上の帯 ===== */
  .status {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
  }
  .quit {
    color: var(--sub);
    text-decoration: none;
    font-size: 0.9rem;
    /* 残り時間とスコアを右に寄せるため、やめるリンクの右側を空ける */
    margin-right: auto;
  }
  .status-item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .status-label {
    font-size: 0.7rem;
    color: var(--sub);
  }
  .status-value {
    font-size: 1.5rem;
    font-weight: bold;
    /* 数字の幅をそろえて、数字が変わってもガタガタしないようにする */
    font-variant-numeric: tabular-nums;
  }
  .status-value small {
    font-size: 0.7rem;
    margin-left: 2px;
  }
  .score {
    color: var(--accent);
  }

  /* ===== 5秒ゲージ ===== */
  .gauge {
    height: 10px;
    margin: 0 16px;
    background: var(--line);
    border-radius: 5px;
    overflow: hidden;
  }
  .gauge-fill {
    height: 100%;
    background: var(--accent);
  }

  /* ===== 問題を出す場所（残りの高さをいっぱいに使い、中身を中央に） ===== */
  .question {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
  }

  /* 「🔈 もう一度」ボタン */
  .replay {
    /* アイコンと文字を横に並べる */
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 32px;
    font-size: 1.3rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 999px;
    color: inherit;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
  /* アイコンだけアクセントのオレンジにする（文字はふつうの色のまま） */
  .replay :global(svg) {
    color: var(--accent);
  }
  .replay:active {
    transform: scale(0.96);
  }

  /* 確認用の文字 */
  .debug {
    margin: 0;
    font-size: 0.85rem;
    color: var(--sub);
  }

  /* ===== 下のドレミのボタン ===== */
  .answers {
    display: grid;
    /* 7つのボタンを同じ幅で横1列に並べる */
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    padding: 8px 8px 12px;
  }
  .answer {
    height: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 0;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    color: inherit;
    box-shadow: 0 2px 0 var(--line);
    /* ボタンの文字が選択（青く反転）されないようにする */
    user-select: none;
    -webkit-user-select: none;
  }
  /* 押している間は少し下に沈んだように見せる */
  .answer:active {
    transform: translateY(2px);
    box-shadow: none;
  }
  /* 正解のとき：緑に光る（文字は白） */
  .answer.ok {
    background: var(--ok);
    border-color: var(--ok);
    color: #ffffff;
  }
  /* お手つきのとき：赤に光る（文字は白） */
  .answer.ng {
    background: var(--ng);
    border-color: var(--ng);
    color: #ffffff;
  }
  /* 光っているときは、小さい英語の音名も白にする */
  .answer.ok .answer-letter,
  .answer.ng .answer-letter {
    color: #ffffff;
  }
  .answer-name {
    font-size: 1.15rem;
    font-weight: bold;
  }
  .answer-letter {
    font-size: 0.75rem;
    color: var(--sub);
  }

  /* ===== まちがった URL のとき ===== */
  .not-found {
    padding: 48px 16px;
    text-align: center;
  }
</style>
