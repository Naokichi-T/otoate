<!--
	+page.svelte（ホーム）
	アプリを開いて最初に出る画面
	- アプリの名前
	- 「読む」「聴く」のモードを選ぶカード（押すとゲーム画面へ）
	- それぞれの最高スコア（ステップ5で保存の仕組みを作るまでは「—」）
-->
<script>
  import { MODES } from "../lib/notes.js";
</script>

<main class="home">
  <!-- アプリの名前 -->
  <header class="title-area">
    <h1>音当て</h1>
    <p class="lead">30秒で何問わかるかな？</p>
  </header>

  <!-- モードを選ぶカード（MODES の数だけ並べる） -->
  <nav class="modes">
    {#each MODES as mode (mode.id)}
      <a class="mode-card" href={`/play/${mode.id}`}>
        <!-- アイコン（mode.icon に入っている部品をそのまま表示する） -->
        <span class="icon"><mode.icon size={44} /></span>
        <span class="text">
          <span class="mode-title">{mode.title}</span>
          <span class="mode-desc">{mode.desc}</span>
        </span>
        <!-- 最高スコア（ステップ5で本物の値を出す） -->
        <span class="best">
          <span class="best-label">最高</span>
          <span class="best-value">—</span>
        </span>
      </a>
    {/each}
  </nav>
</main>

<style>
  /* 画面全体：中身を上下中央あたりに寄せる */
  .home {
    min-height: 100dvh;
    max-width: 480px;
    margin: 0 auto;
    padding: 48px 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 40px;
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

  /* モードのカード1枚：左に絵文字、まん中に名前と説明、右に最高スコア */
  .mode-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 16px;
    color: inherit;
    text-decoration: none;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  }
  /* 押したときに少しへこんだように見せる */
  .mode-card:active {
    transform: scale(0.98);
  }

  /* アイコン：アクセントのオレンジ（アイコンは color の色になる） */
  .icon {
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
  }

  /* 名前と説明を縦に並べ、残りの幅をいっぱいに使う */
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mode-title {
    font-size: 1.4rem;
    font-weight: bold;
  }
  .mode-desc {
    font-size: 0.85rem;
    color: var(--sub);
  }

  /* 最高スコア：小さい見出しの下に数字 */
  .best {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 56px;
  }
  .best-label {
    font-size: 0.75rem;
    color: var(--sub);
  }
  .best-value {
    font-size: 1.3rem;
    font-weight: bold;
    color: var(--accent);
  }
</style>
