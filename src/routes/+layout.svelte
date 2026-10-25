<!--
	+layout.svelte
	すべてのページに共通する外枠
	- ファビコン（ステップ7で音当て用の画像に差し替える）
	- アプリ全体の色・文字・余白の決まり（CSS）
-->
<script>
  // ファビコンの画像（今はプロジェクト作成時のままの Svelte のロゴ）
  // どのバージョンの SvelteKit でも動くように、相対パスで読み込む
  import favicon from "../lib/assets/favicon.svg";

  // 各ページの中身（+page.svelte）を受け取る
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<!-- 各ページの中身をここに表示する -->
{@render children()}

<style>
  /* ------------------------------------------------------------
	   アプリ全体で使う色の決まり
	   あとで色を変えたくなったら、ここだけ直せばよい
	   ------------------------------------------------------------ */
  :global(:root) {
    --bg: #f6f4ef; /* 背景（少しあたたかい白） */
    --panel: #ffffff; /* カードやボタンの地の色 */
    --ink: #222222; /* ふつうの文字 */
    --sub: #777777; /* うすい文字（説明など） */
    --line: #dddddd; /* 枠線 */
    --accent: #e07a2f; /* 目立たせたいところ（オレンジ） */
    --ok: #3aa55d; /* 正解（緑） */
    --ng: #d9534f; /* お手つき（赤） */
  }

  /* ページ全体の基本の見た目 */
  :global(html, body) {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--ink);
    font-family:
      system-ui,
      -apple-system,
      "Hiragino Sans",
      "Noto Sans JP",
      sans-serif;
    /* スマホでボタンを連打したときに画面が拡大されないようにする */
    touch-action: manipulation;
    /* スマホでボタンを押したときの青い枠を出さない */
    -webkit-tap-highlight-color: transparent;
  }

  /* 幅や高さに枠線・余白を含める（レイアウトの計算をわかりやすくするため） */
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
</style>
