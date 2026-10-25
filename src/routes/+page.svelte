<!--
	+page.svelte（ホーム）
	アプリを開いて最初に出る画面
	- アプリの名前
	- 「読む」「聴く」のモードのカード
	- カードの中に、レベルのボタン（Lv1・Lv2…）と、そのレベルの最高スコア
	  ボタンを押すと、そのモード・レベルのゲーム画面（/play/read/1 など）へ
-->
<script>
  import { onMount } from "svelte";
  import { MODES } from "../lib/notes.js";
  import { loadBestScores } from "../lib/best.js";

  // 保存してある最高スコア（"read-1" → 123 のような形）
  // localStorage はブラウザでしか読めないので、画面が表示されてから読み込む
  /** @type {Record<string, number>} */
  let bestScores = $state({});

  onMount(() => {
    bestScores = loadBestScores();
  });

  // ------------------------------------------------------------
  // bestText(modeId, levelId)
  // あるモード・レベルの最高スコアを、画面に出す文字にする関数（記録がなければ「—」）
  // ------------------------------------------------------------
  /**
   * @param {string} modeId モードの id
   * @param {number} levelId レベルの番号
   * @returns {string} 画面に出す文字
   */
  function bestText(modeId, levelId) {
    const value = bestScores[`${modeId}-${levelId}`];
    return typeof value === "number" ? String(value) : "—";
  }
</script>

<main class="home">
  <!-- アプリの名前 -->
  <header class="title-area">
    <h1>音当て</h1>
    <p class="lead">1分で何問わかるかな？</p>
  </header>

  <!-- モードのカード（MODES の数だけ並べる） -->
  <div class="modes">
    {#each MODES as mode (mode.id)}
      <section class="mode-card">
        <!-- カードの上の部分：アイコン・名前・説明 -->
        <div class="mode-head">
          <!-- アイコン（mode.icon に入っている部品をそのまま表示する） -->
          <span class="icon"><mode.icon size={40} /></span>
          <div class="text">
            <h2 class="mode-title">{mode.title}</h2>
            <p class="mode-desc">{mode.desc}</p>
          </div>
        </div>

        <!--
					レベルのボタン（レベルの数だけ横に並べる）
					style の --count … 1行に並べる数（読む＝2、聴く＝3）を CSS に渡す
				-->
        <nav class="levels" style={`--count: ${mode.levels.length}`}>
          {#each mode.levels as level (level.id)}
            <a class="level" href={`/play/${mode.id}/${level.id}`}>
              <span class="level-label">{level.label}</span>
              <span class="level-desc">{level.desc}</span>
              <span class="level-best">
                <span class="best-label">最高</span>
                <span class="best-value">{bestText(mode.id, level.id)}</span>
              </span>
            </a>
          {/each}
        </nav>
      </section>
    {/each}
  </div>
</main>

<style>
  /* 画面全体 */
  .home {
    min-height: 100dvh;
    max-width: 480px;
    margin: 0 auto;
    padding: 40px 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* アプリの名前の部分 */
  .title-area {
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 2.6rem;
    letter-spacing: 0.1em;
  }
  .lead {
    margin: 8px 0 0;
    color: var(--sub);
  }

  /* モードのカードを縦に並べる */
  .modes {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* モードのカード1枚 */
  .mode-card {
    padding: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 16px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  }

  /* カードの上の部分：左にアイコン、右に名前と説明 */
  .mode-head {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  /* アイコン：アクセントのオレンジ（アイコンは color の色になる） */
  .icon {
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
  }

  .text {
    flex: 1;
  }
  .mode-title {
    margin: 0;
    font-size: 1.4rem;
  }
  .mode-desc {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: var(--sub);
  }

  /* レベルのボタン：--count の数だけ同じ幅で横に並べる */
  .levels {
    display: grid;
    grid-template-columns: repeat(var(--count), 1fr);
    gap: 8px;
  }

  /* レベルのボタン1つ：上から「Lv1」「説明」「最高 ○」 */
  .level {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 4px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 12px;
    color: inherit;
    text-decoration: none;
  }
  /* 押したときに少しへこんだように見せる */
  .level:active {
    transform: scale(0.96);
  }

  .level-label {
    font-size: 1.1rem;
    font-weight: bold;
  }
  .level-desc {
    font-size: 0.72rem;
    color: var(--sub);
    /* 説明が長くても1行に収める（はみ出たら「…」） */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* 最高スコア：「最高」の小さい文字の横に数字 */
  .level-best {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-top: 4px;
  }
  .best-label {
    font-size: 0.7rem;
    color: var(--sub);
  }
  .best-value {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
</style>
