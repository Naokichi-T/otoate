<!--
	play/[mode]/+page.svelte（ゲーム画面）
	URL の最後の部分でモードが決まる
	  /play/read   … 「読む」モード（五線譜の音符を見て答える）
	  /play/listen … 「聴く」モード（鳴った音を聴いて答える）

	ステップ1では画面の骨組みだけを作る
	- 上：やめるリンク・残り時間・スコア（数字はまだ固定）
	- その下：5秒ゲージ（まだ動かない）
	- まん中：問題を出す場所（読む＝五線譜の場所、聴く＝もう一度ボタン）
	- 下：ド〜シの7つのボタン（押すと、押したボタンの名前を表示するだけ）
-->
<script>
  import { page } from "$app/state";
  import { NOTE_BUTTONS, findMode } from "../../../lib/notes.js";

  // URL の [mode] の部分から、今のモードの情報を探す
  // まちがった URL（/play/abc など）のときは null になる
  let mode = $derived(findMode(page.params.mode));

  // 最後に押したボタン（ボタンが反応しているかを確かめるための仮の表示）
  let lastPressed = $state(null);

  // ------------------------------------------------------------
  // handleAnswer(button)
  // 下のドレミのボタンが押されたときに呼ばれる関数
  // ステップ1では、押したボタンを覚えて画面に出すだけ
  // （ステップ2で、ここに正解・お手つきの判定を入れる）
  // ------------------------------------------------------------
  function handleAnswer(button) {
    lastPressed = button;
  }

  // ------------------------------------------------------------
  // handleReplay()
  // 「聴く」モードの「🔈 もう一度」ボタンが押されたときに呼ばれる関数
  // ステップ6で、ここに音を鳴らす処理を入れる（今は何もしない）
  // ------------------------------------------------------------
  function handleReplay() {
    // まだ何もしない
  }
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
        <!-- 「読む」：ステップ2でここに五線譜と音符を描く -->
        <div class="staff-placeholder">（ここに五線譜と音符）</div>
      {:else}
        <!-- 「聴く」：もう一度鳴らすボタン -->
        <button class="replay" type="button" onclick={handleReplay}> 🔈 もう一度 </button>
      {/if}

      <!-- 押したボタンの確認用（ステップ2で消す） -->
      <p class="debug">
        押したボタン：{lastPressed ? `${lastPressed.name}（${lastPressed.letter}）` : "まだなし"}
      </p>
    </section>

    <!-- ===== 下のドレミのボタン（7つを横1列に並べる） ===== -->
    <nav class="answers">
      {#each NOTE_BUTTONS as button (button.id)}
        <button class="answer" type="button" onclick={() => handleAnswer(button)}>
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

  /* 五線譜の仮の場所 */
  .staff-placeholder {
    width: 100%;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--line);
    border-radius: 12px;
    color: var(--sub);
  }

  /* 「🔈 もう一度」ボタン */
  .replay {
    padding: 16px 32px;
    font-size: 1.3rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 999px;
    color: inherit;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
  .replay:active {
    transform: scale(0.96);
  }

  /* 押したボタンの確認用の文字 */
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
