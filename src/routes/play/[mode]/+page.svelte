<!--
	play/[mode]/+page.svelte（ゲーム画面）
	URL の最後の部分でモードが決まる
	  /play/read   … 「読む」モード（五線譜の音符を見て答える）
	  /play/listen … 「聴く」モード（鳴った音を聴いて答える）

	画面の並び
	- 上：やめるリンク・残り時間・スコア（スコアはステップ4で動かす）
	- その下：5秒ゲージ
	- まん中：問題を出す場所（読む＝五線譜と音符、聴く＝もう一度ボタン）
	- 下：ド〜シの7つのボタン

	ゲームの進み方（phase ＝ 今どの段階か）
	  "ready"     … スタート前。「スタート」ボタンを出す（下のボタンは見えるが押せない）
	  "countdown" … 「3・2・1」と数えている（下のボタンは見えるが押せない）
	  "playing"   … プレイ中。1分（60秒）の残り時間と5秒ゲージが減っていく
	  "finished"  … 制限時間になった。問題とボタンのかわりに結果のカードを出す

	問題の答え方
	- 正しいボタン → ボタンが0.2秒緑に光って、すぐ次の問題へ（ゲージは満タンに戻る）
	- ちがうボタン → ボタンと音符が0.2秒赤に光って、お手つき＋1（同じ問題のまま、ゲージも戻らない）
	- 5秒ゲージが0になっても次へは進まない（空のまま答えを待つ）
-->
<script>
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { NOTE_BUTTONS, ALL_NOTES, findMode, pickNextNote } from "../../../lib/notes.js";
  import Staff from "../../../lib/Staff.svelte";
  import SpeakerIcon from "../../../lib/icons/SpeakerIcon.svelte";

  // ------------------------------------------------------------
  // 時間の決まり
  // ------------------------------------------------------------
  const GAME_SECONDS = 60; // 1回のゲームの制限時間（秒）。30秒にしたいときはここを 30 にする
  const THINK_SECONDS = 5; // 1問ごとの5秒ゲージの長さ（秒）
  const COUNTDOWN_FROM = 3; // スタート前に数える数（3・2・1）
  const WARNING_SECONDS = 5; // 残り時間がこの秒数以下になったら赤い文字にする
  const FLASH_MS = 200; // ボタンが緑・赤に光っている時間（ミリ秒）

  // URL の [mode] の部分から、今のモードの情報を探す
  // まちがった URL（/play/abc など）のときは null になる
  let mode = $derived(findMode(page.params.mode));

  // 今どの段階か（上のコメントの4つのどれか）
  // 「@type」を ("ready") の前に付けて、4つのどれかが入ることを VSCode に教えている
  // （書かないと、VSCode が「"ready" しか入らない」と思いこんでしまう）
  /** @typedef {"ready" | "countdown" | "playing" | "finished"} Phase */
  let phase = $state(/** @type {Phase} */ ("ready"));

  // カウントダウンで今表示している数（3 → 2 → 1）
  let countdown = $state(COUNTDOWN_FROM);

  // 今の問題の音（スタート前はまだ決まっていないので null）
  /** @type {import("../../../lib/notes.js").QuizNote | null} */
  let currentNote = $state(null);

  // 正解した数とお手つきの数（ステップ4で、スコアや結果画面に使う）
  let correctCount = $state(0);
  let missCount = $state(0);

  // ------------------------------------------------------------
  // 時間を測るための時刻（すべて performance.now() のミリ秒）
  // performance.now() … ページを開いてからの経過時間。時計を合わせ直しても狂わない
  // ------------------------------------------------------------
  let gameStartedAt = 0; // ゲームが始まった時刻
  let questionStartedAt = 0; // 今の問題が出た時刻
  let now = $state(0); // 画面を書き換えるたびに更新する「今の時刻」

  // 制限時間の残り（秒、小数あり）。プレイ中以外は満タンか0で固定
  let remainingSeconds = $derived(phase === "playing" ? Math.max(0, GAME_SECONDS - (now - gameStartedAt) / 1000) : phase === "finished" ? 0 : GAME_SECONDS);

  // 画面に出す残り時間（整数の秒）。59.2秒なら「60」、0.4秒なら「1」と切り上げる
  let remainingDisplay = $derived(Math.ceil(remainingSeconds));

  // 5秒ゲージの残り（0 〜 1 の割合。1 ＝ 満タン、0 ＝ 空）
  let gaugeRatio = $derived(phase === "playing" ? Math.max(0, 1 - (now - questionStartedAt) / 1000 / THINK_SECONDS) : phase === "finished" ? 0 : 1);

  // 光らせているボタン
  //   id   : 光らせるボタンの id（"C" など）
  //   kind : "ok"（正解・緑）か "ng"（お手つき・赤）
  /** @type {{ id: string, kind: "ok" | "ng" } | null} */
  let flash = $state(null);

  // タイマーの番号（止めるときのために覚えておく）
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let flashTimer; // ボタンの光を消すタイマー
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let countdownTimer; // 3・2・1 を数えるタイマー
  /** @type {number | undefined} */
  let frameId; // 画面の書き換えごとに時刻を更新する仕組み（requestAnimationFrame）の番号

  // ------------------------------------------------------------
  // nextQuestion()
  // 次の問題の音を選んで画面に出し、5秒ゲージを満タンに戻す関数
  // ------------------------------------------------------------
  function nextQuestion() {
    currentNote = pickNextNote(ALL_NOTES, currentNote);
    questionStartedAt = performance.now();
  }

  // ------------------------------------------------------------
  // startCountdown()
  // 「スタート」ボタンが押されたときに呼ばれる関数
  // 数えた数を0にもどしてから、3・2・1 と1秒ずつ数え、終わったらゲームを始める
  // ------------------------------------------------------------
  function startCountdown() {
    // 前のゲームの結果を消す
    correctCount = 0;
    missCount = 0;
    currentNote = null;

    phase = "countdown";
    countdown = COUNTDOWN_FROM;
    tickCountdown();
  }

  // ------------------------------------------------------------
  // tickCountdown()
  // 1秒後に数を1つ減らす関数（0 になったらゲームを始める）
  // 自分自身をもう一度呼ぶことで、3 → 2 → 1 → スタート と進む
  // ------------------------------------------------------------
  function tickCountdown() {
    countdownTimer = setTimeout(() => {
      countdown--;
      if (countdown > 0) {
        tickCountdown();
      } else {
        startGame();
      }
    }, 1000);
  }

  // ------------------------------------------------------------
  // startGame()
  // プレイを始める関数：時刻を記録し、最初の問題を出し、時間の計測を始める
  // ------------------------------------------------------------
  function startGame() {
    phase = "playing";
    gameStartedAt = performance.now();
    now = gameStartedAt;
    nextQuestion();
    frameId = requestAnimationFrame(updateClock);
  }

  // ------------------------------------------------------------
  // updateClock()
  // 画面が書き換わるたびに（1秒に約60回）呼ばれる関数
  // 「今の時刻」を更新して、制限時間がたっていたらゲームを終える
  // ------------------------------------------------------------
  function updateClock() {
    now = performance.now();
    if (now - gameStartedAt >= GAME_SECONDS * 1000) {
      finishGame();
      return; // 次の書き換えの予約はしない（時計を止める）
    }
    frameId = requestAnimationFrame(updateClock);
  }

  // ------------------------------------------------------------
  // finishGame()
  // 制限時間になったときに呼ばれる関数：時計を止めて結果を出す
  // ------------------------------------------------------------
  function finishGame() {
    phase = "finished";
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    clearTimeout(flashTimer);
    flash = null;
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
    // プレイ中でないとき・問題がまだ出ていないときは何もしない
    if (phase !== "playing" || !currentNote) return;

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

  // 画面を離れるときに、動いているタイマーや時計をすべて止める
  onMount(() => {
    return () => {
      clearTimeout(flashTimer);
      clearTimeout(countdownTimer);
      if (frameId !== undefined) cancelAnimationFrame(frameId);
    };
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
        <!-- 残り5秒以下（プレイ中）は赤い文字にする -->
        <span class="status-value" class:warning={phase === "playing" && remainingDisplay <= WARNING_SECONDS}>
          {remainingDisplay}<small>秒</small>
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">スコア</span>
        <span class="status-value score">0</span>
      </div>
    </header>

    <!-- ===== 5秒ゲージ（残りの割合に合わせて、オレンジの部分の幅を変える） ===== -->
    <div class="gauge" aria-label="残りの考える時間">
      <div class="gauge-fill" style={`width: ${gaugeRatio * 100}%`}></div>
    </div>

    {#if phase === "finished"}
      <!-- ===== 結果のカード（問題とボタンのかわりに出す） ===== -->
      <section class="result">
        <div class="result-card">
          <h2>おしまい！</h2>
          <dl class="result-list">
            <div class="result-row">
              <dt>正解</dt>
              <dd>{correctCount}<small>問</small></dd>
            </div>
            <div class="result-row">
              <dt>お手つき</dt>
              <dd>{missCount}<small>回</small></dd>
            </div>
          </dl>
          <div class="result-actions">
            <button class="primary" type="button" onclick={startCountdown}>もう一度</button>
            <a class="secondary" href="/">ホームへ</a>
          </div>
        </div>
      </section>
    {:else}
      <!-- ===== 問題を出す場所 ===== -->
      <section class="question">
        {#if mode.id === "read"}
          <!--
						「読む」：五線譜に今の問題の音符を描く（スタート前・カウント中は五線だけ）
						highlight … 音符の色。お手つきでボタンが赤く光っているあいだだけ "ng"（赤）にする
						正解のときはすぐ次の音符に変わるので、色は付けない（黒のまま）
					-->
          <Staff note={currentNote} highlight={flash?.kind === "ng" ? "ng" : null} />
        {/if}

        <!--
					五線譜の下の場所（スタートボタン・カウントの数字・もう一度ボタン）
					中身が変わっても高さが変わらないようにして、五線譜が上下に動かないようにする
				-->
        <div class="control">
          {#if phase === "ready"}
            <!-- スタート前：スタートボタン -->
            <button class="start" type="button" onclick={startCountdown}>スタート</button>
          {:else if phase === "countdown"}
            <!-- カウント中：大きな数字（{#key} で、数が変わるたびに出し直してアニメーションさせる） -->
            {#key countdown}
              <p class="countdown">{countdown}</p>
            {/key}
          {:else if mode.id === "listen"}
            <!-- 「聴く」のプレイ中：もう一度鳴らすボタン -->
            <button class="replay" type="button" onclick={handleReplay}>
              <SpeakerIcon size={26} />
              <span>もう一度</span>
            </button>
          {/if}
        </div>

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
						disabled … プレイ中以外は押せない（見た目はそのまま）
					-->
          <button
            class="answer"
            class:ok={flash?.id === button.id && flash?.kind === "ok"}
            class:ng={flash?.id === button.id && flash?.kind === "ng"}
            type="button"
            disabled={phase !== "playing"}
            onclick={() => handleAnswer(button)}
          >
            <span class="answer-name">{button.name}</span>
            <span class="answer-letter">{button.letter}</span>
          </button>
        {/each}
      </nav>
    {/if}
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
  /* 残り時間が少ないとき（残り5秒以下）は赤い文字 */
  .warning {
    color: var(--ng);
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

  /* 五線譜の下の場所：中身が変わっても同じ高さ（いちばん高いカウントの数字に合わせる） */
  .control {
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 「スタート」ボタン（大きくて目立つオレンジ） */
  .start {
    padding: 16px 56px;
    font-size: 1.4rem;
    font-weight: bold;
    background: var(--accent);
    border: none;
    border-radius: 999px;
    color: #ffffff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
  }
  .start:active {
    transform: scale(0.96);
  }

  /* カウントダウンの数字：出るたびに大きい状態から縮むアニメーション */
  .countdown {
    margin: 0;
    font-size: 4rem;
    font-weight: bold;
    line-height: 1;
    color: var(--accent);
    animation: pop 1s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(1.6);
      opacity: 0;
    }
    30% {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
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
  /* 押せないとき（スタート前・カウント中）も、見た目はふつうのまま（文字を薄くしない） */
  .answer:disabled {
    color: inherit;
    opacity: 1;
  }
  /* 押している間は少し下に沈んだように見せる（押せるときだけ） */
  .answer:not(:disabled):active {
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

  /* ===== 結果のカード ===== */
  .result {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .result-card {
    width: 100%;
    max-width: 360px;
    padding: 24px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    text-align: center;
  }
  .result-card h2 {
    margin: 0 0 16px;
    font-size: 1.6rem;
  }

  /* 結果の一覧：左に項目名、右に数字 */
  .result-list {
    margin: 0 0 24px;
  }
  .result-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 4px;
    border-bottom: 1px solid var(--line);
  }
  .result-row dt {
    color: var(--sub);
  }
  .result-row dd {
    margin: 0;
    font-size: 1.6rem;
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }
  .result-row small {
    font-size: 0.8rem;
    margin-left: 2px;
  }

  /* 「もう一度」「ホームへ」を縦に並べる */
  .result-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .primary {
    padding: 14px;
    font-size: 1.1rem;
    font-weight: bold;
    background: var(--accent);
    border: none;
    border-radius: 999px;
    color: #ffffff;
  }
  .secondary {
    padding: 12px;
    color: var(--sub);
    text-decoration: none;
  }

  /* ===== まちがった URL のとき ===== */
  .not-found {
    padding: 48px 16px;
    text-align: center;
  }
</style>
