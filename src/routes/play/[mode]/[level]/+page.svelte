<!--
	play/[mode]/[level]/+page.svelte（ゲーム画面）
	URL の「/play/モード/レベル」でモードとレベルが決まる
	  /play/read/1   … 「読む」Lv1（五線の中の音）
	  /play/read/2   … 「読む」Lv2（加線の音もあり）
	  /play/listen/1 … 「聴く」Lv1〜3（Lv1・Lv2 は基準のラあり、Lv3 はなし）

	画面の並び
	- 上：やめるリンク・残り時間・スコア
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

	点数（計算の決まりは src/lib/score.js）
	- 正解するたびに 10点 ＋ ゲージの残り秒数 × 2点（四捨五入して整数）
	- 反応時間 ＝ 問題が出てから正解を押すまで（お手つきで迷った時間も含む）
	- 結果のカードに、スコア・最高スコア・正解の数・平均反応速度・お手つきの数を出す
	- 最高スコアを超えたら保存して「NEW!」を出す（保存のしかたは src/lib/best.js）

	「聴く」モードの音（鳴らし方は src/lib/sound.js）
	- 「スタート」を押したときに音を出す準備をする（スマホは画面を触らないと音を出せないため）
	- Lv1・Lv2 は、カウントの「3」で基準のラ（ラ4）を1回鳴らす。1問目はラ4 にしない
	- 問題が出るたびに、その音を鳴らす（5秒ゲージは鳴り始めと同時に減り始める）
	- 「もう一度」で問題の音を、「基準のラ」でラ4 を鳴らす（ゲージは戻らない）
	- そのレベルで出ない音名のボタン（Lv1 のド）はグレーにして押せない
-->
<script>
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { NOTE_BUTTONS, findMode, findLevel, pickNextNote } from "../../../../lib/notes.js";
  import { getBestScore, saveBestScore } from "../../../../lib/best.js";
  import Staff from "../../../../lib/Staff.svelte";
  import SpeakerIcon from "../../../../lib/icons/SpeakerIcon.svelte";
  import { THINK_SECONDS, calcPoints, averageSeconds, formatSeconds } from "../../../../lib/score.js";
  import { unlockAudio, playNote, playReference, stopTone } from "../../../../lib/sound.js";

  // ------------------------------------------------------------
  // 時間の決まり
  // ------------------------------------------------------------
  const GAME_SECONDS = 60; // 1回のゲームの制限時間（秒）。30秒にしたいときはここを 30 にする
  // 1問ごとの5秒ゲージの長さ（THINK_SECONDS）は、点数の計算にも使うので score.js に置いている
  const COUNTDOWN_FROM = 3; // スタート前に数える数（3・2・1）
  const WARNING_SECONDS = 5; // 残り時間がこの秒数以下になったら赤い文字にする
  const FLASH_MS = 200; // ボタンが緑・赤に光っている時間（ミリ秒）

  // 次の問題を、直前の音から白鍵でいくつ以上はなした音にするか
  //   「読む」… 2（同じ音と1音差の音は出さない。五線譜の上で場所がほとんど変わらず簡単になるため）
  //   「聴く」… 1（同じ音だけ出さない。ステップ6で考え直すかも）
  const READ_MIN_DISTANCE = 2;
  const LISTEN_MIN_DISTANCE = 1;

  // URL の [mode] の部分から、今のモードの情報を探す
  // まちがった URL（/play/abc など）のときは null になる
  let mode = $derived(findMode(page.params.mode));

  // URL の [level] の部分から、今のレベルの情報を探す
  // モードがまちがっているとき・レベルがまちがっているとき（/play/read/9 など）は null になる
  let level = $derived(mode ? findLevel(mode, page.params.level) : null);

  // 今のモードが「聴く」か（音を鳴らすかどうかの判断に使う）
  let isListen = $derived(mode?.id === "listen");

  // 基準のラを使うレベルか（「聴く」Lv1・Lv2 は true、Lv3 と「読む」は false）
  let useReference = $derived(isListen && (level?.reference ?? false));

  // このレベルで出題される音名（"C" など）の一覧
  // 答えのボタンのうち、ここに入っていない音名（「聴く」Lv1 のド）はグレーにして押せないようにする
  let usedLetters = $derived(new Set((level?.notes ?? []).map((n) => n.letter)));

  // 最高スコア（結果のカードに出す）と、今回が新記録だったか
  /** @type {number | null} */
  let bestScore = $state(null);
  let isNewRecord = $state(false);

  // 今どの段階か（上のコメントの4つのどれか）
  // 「@type」を ("ready") の前に付けて、4つのどれかが入ることを VSCode に教えている
  // （書かないと、VSCode が「"ready" しか入らない」と思いこんでしまう）
  /** @typedef {"ready" | "countdown" | "playing" | "finished"} Phase */
  let phase = $state(/** @type {Phase} */ ("ready"));

  // カウントダウンで今表示している数（3 → 2 → 1）
  let countdown = $state(COUNTDOWN_FROM);

  // 今の問題の音（スタート前はまだ決まっていないので null）
  /** @type {import("../../../../lib/notes.js").QuizNote | null} */
  let currentNote = $state(null);

  // 正解した数とお手つきの数
  let correctCount = $state(0);
  let missCount = $state(0);

  // スコア（合計点）
  let score = $state(0);

  // 正解したときの反応時間のリスト（ミリ秒）。結果のカードで平均を出すのに使う
  /** @type {number[]} */
  let reactionTimes = $state([]);

  // 平均反応速度（画面に出す文字。例："1.23"、正解が0問なら "—"）
  let averageText = $derived(formatSeconds(averageSeconds(reactionTimes)));

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
  // 次の問題の音を選んで画面に出し（「聴く」なら鳴らし）、5秒ゲージを満タンに戻す関数
  // 「読む」では、直前の音と1音差の音も出さない
  // ------------------------------------------------------------
  function nextQuestion() {
    const minDistance = mode?.id === "read" ? READ_MIN_DISTANCE : LISTEN_MIN_DISTANCE;

    // 出題する音は、レベルごとに決まっている（例：「読む」Lv1 は五線の中の9音）
    let notes = level?.notes ?? [];

    // 基準のラを鳴らしたあとの1問目は、ラ4 を出さない（基準と同じ音だとすぐわかってしまうため）
    if (useReference && currentNote === null) {
      notes = notes.filter((n) => n.id !== "A4");
    }

    currentNote = pickNextNote(notes, currentNote, minDistance);
    questionStartedAt = performance.now();

    // 「聴く」なら、問題の音を鳴らす
    if (isListen && currentNote) playNote(currentNote);
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
    score = 0;
    reactionTimes = [];
    currentNote = null;
    isNewRecord = false;

    // 音を出す準備（スマホは、ボタンを押したこの瞬間に準備しないと音が出ない）
    if (isListen) unlockAudio();

    phase = "countdown";
    countdown = COUNTDOWN_FROM;

    // 基準のラを使うレベルなら、カウントの「3」と同時に鳴らす
    if (useReference) playReference();

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
  // 制限時間になったときに呼ばれる関数：時計を止めて、最高スコアを確かめてから結果を出す
  // ------------------------------------------------------------
  function finishGame() {
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    clearTimeout(flashTimer);
    flash = null;
    stopTone(); // 鳴っている音があれば止める

    // 最高スコアより高ければ保存して「NEW!」を出す
    if (mode && level) {
      isNewRecord = saveBestScore(mode.id, level.id, score);
      bestScore = getBestScore(mode.id, level.id);
    }
    phase = "finished";
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
  /** @param {import("../../../../lib/notes.js").NoteButton} button 押されたボタンのデータ */
  function handleAnswer(button) {
    // プレイ中でないとき・問題がまだ出ていないときは何もしない
    if (phase !== "playing" || !currentNote) return;

    if (button.id === currentNote.letter) {
      // 正解：反応時間を記録して点数を足し、ボタンだけ緑に光らせて、すぐ次の問題へ（音符は黒のまま）
      const reactionMs = performance.now() - questionStartedAt;
      reactionTimes.push(reactionMs);
      score += calcPoints(reactionMs);
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
  // 今の問題の音をもう一度鳴らす（5秒ゲージは戻らない）
  // ------------------------------------------------------------
  function handleReplay() {
    if (phase === "playing" && currentNote) playNote(currentNote);
  }

  // ------------------------------------------------------------
  // handleReference()
  // 「基準のラ」ボタンが押されたときに呼ばれる関数
  // ラ4（442Hz）を鳴らす（5秒ゲージは戻らない）
  // ------------------------------------------------------------
  function handleReference() {
    if (phase === "playing") playReference();
  }

  // 画面を離れるときに、動いているタイマーや時計をすべて止める
  onMount(() => {
    return () => {
      clearTimeout(flashTimer);
      clearTimeout(countdownTimer);
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      stopTone(); // 鳴っている音があれば止める（やめるでホームに戻ったときなど）
    };
  });
</script>

<svelte:head>
  <title>{mode && level ? `${mode.title} ${level.label} | 音当て` : "音当て"}</title>
</svelte:head>

{#if mode && level}
  <main class="game">
    <!-- ===== 上の帯：やめる・モードとレベル・残り時間・スコア ===== -->
    <header class="status">
      <div class="quit-area">
        <a class="quit" href="/">← やめる</a>
        <span class="level-tag">{mode.title} {level.label}</span>
      </div>
      <div class="status-item">
        <span class="status-label">残り</span>
        <!-- 残り5秒以下（プレイ中）は赤い文字にする -->
        <span class="status-value" class:warning={phase === "playing" && remainingDisplay <= WARNING_SECONDS}>
          {remainingDisplay}<small>秒</small>
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">スコア</span>
        <span class="status-value score">{score}</span>
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
          <!-- スコアはいちばん上に大きく出す -->
          <p class="result-score-label">スコア</p>
          <p class="result-score">
            {score}
            <!-- 新記録のときだけ「NEW!」の札を付ける -->
            {#if isNewRecord}<span class="new-badge">NEW!</span>{/if}
          </p>
          <!-- そのレベルの最高スコア（記録がなければ「—」） -->
          <p class="result-best">
            {mode.title}
            {level.label} の最高　<strong>{bestScore ?? "—"}</strong>
          </p>
          <dl class="result-list">
            <div class="result-row">
              <dt>正解</dt>
              <dd>{correctCount}<small>問</small></dd>
            </div>
            <div class="result-row">
              <dt>平均反応速度</dt>
              <dd>{averageText}<small>秒</small></dd>
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
          {:else if isListen}
            <!-- 「聴く」のプレイ中：左に「基準のラ」（Lv1・Lv2 だけ）、右に「もう一度」 -->
            <div class="listen-buttons">
              {#if useReference}
                <button class="replay reference" type="button" onclick={handleReference}>
                  <span>基準のラ</span>
                </button>
              {/if}
              <button class="replay" type="button" onclick={handleReplay}>
                <SpeakerIcon size={26} />
                <span>もう一度</span>
              </button>
            </div>
          {/if}
        </div>
      </section>

      <!-- ===== 下のドレミのボタン（7つを横1列に並べる） ===== -->
      <nav class="answers">
        {#each NOTE_BUTTONS as button (button.id)}
          <!--
						光らせているボタンには、ok（緑）か ng（赤）のクラスを付ける
						class:ok={条件} … 条件が true のときだけ「ok」というクラスが付く
						disabled … プレイ中以外は押せない（見た目はそのまま）
						unused   … このレベルで出ない音名（「聴く」Lv1 のド）は、いつもグレーで押せない
					-->
          <button
            class="answer"
            class:ok={flash?.id === button.id && flash?.kind === "ok"}
            class:ng={flash?.id === button.id && flash?.kind === "ng"}
            class:unused={!usedLetters.has(button.id)}
            type="button"
            disabled={phase !== "playing" || !usedLetters.has(button.id)}
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
    <p>このモード・レベルはありません。</p>
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
  /* やめるリンクと、モード・レベルの札を縦に並べる */
  .quit-area {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    /* 残り時間とスコアを右に寄せるため、この部分の右側を空ける */
    margin-right: auto;
  }
  .quit {
    color: var(--sub);
    text-decoration: none;
    font-size: 0.9rem;
  }
  /* 「読む Lv1」の札 */
  .level-tag {
    padding: 2px 8px;
    font-size: 0.75rem;
    font-weight: bold;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 999px;
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

  /* 「基準のラ」と「もう一度」を横に並べる */
  .listen-buttons {
    display: flex;
    gap: 12px;
  }

  /* 「基準のラ」ボタン：「もう一度」と同じ形で、少し控えめ（文字を薄く） */
  .replay.reference {
    padding: 16px 24px;
    color: var(--sub);
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
  /* このレベルで出ない音名のボタン：グレーにして、押せないことがわかるようにする */
  .answer.unused,
  .answer.unused:disabled {
    background: var(--line);
    color: var(--sub);
    box-shadow: none;
    opacity: 0.6;
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

  /* スコア：いちばん大きく、オレンジ */
  .result-score-label {
    margin: 0;
    font-size: 0.85rem;
    color: var(--sub);
  }
  .result-score {
    position: relative; /* 「NEW!」の札をスコアの右上に置くための基準 */
    margin: 0;
    font-size: 3.2rem;
    font-weight: bold;
    line-height: 1.1;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  /* 「NEW!」の札：スコアの右上に、少し傾けて出す */
  .new-badge {
    position: absolute;
    top: 0;
    margin-left: 6px;
    padding: 2px 8px;
    font-size: 0.85rem;
    color: #ffffff;
    background: var(--ng);
    border-radius: 999px;
    transform: rotate(8deg);
  }

  /* そのレベルの最高スコア */
  .result-best {
    margin: 4px 0 12px;
    font-size: 0.85rem;
    color: var(--sub);
  }
  .result-best strong {
    font-size: 1.05rem;
    color: var(--ink);
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
