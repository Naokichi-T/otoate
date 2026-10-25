<!--
	+layout.svelte
	すべてのページに共通する外枠
	- ファビコン（ブラウザのタブのアイコン）とホーム画面用の画像（apple-touch-icon）
	- 楽譜用フォント Bravura の読み込み（五線譜のト音記号と音符に使う）
	- アプリ全体の色・文字・余白の決まり（CSS）
-->
<script>
  // 各ページの中身（+page.svelte）を受け取る
  let { children } = $props();
</script>

<svelte:head>
  <!--
		ファビコン（static フォルダの画像。オレンジの角丸四角に白い音符）
		SVG に対応したブラウザは favicon.svg を、対応していないブラウザは favicon.png（32×32）を使う
	-->
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
  <!-- iPhone の「ホーム画面に追加」で使うアイコン（180×180。角は iPhone が自動で丸める） -->
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <!-- スマホのブラウザの上の帯の色（アプリの背景と同じ色） -->
  <meta name="theme-color" content="#f6f4ef" />
  <!--
		楽譜用フォントを先に読み込み始めておく（preload）
		五線譜を表示したときに、ト音記号が一瞬「□」になるのを防ぐため
	-->
  <link rel="preload" href="/fonts/Bravura.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<!-- 各ページの中身をここに表示する -->
{@render children()}

<style>
  /* ------------------------------------------------------------
	   楽譜用フォント Bravura（static/fonts/Bravura.woff2）
	   font-display: block … 読み込みが終わるまで文字を出さずに待つ
	   （ほかのフォントで「□」が表示されるのを防ぐ）
	   ------------------------------------------------------------ */
  @font-face {
    font-family: "Bravura";
    src: url("/fonts/Bravura.woff2") format("woff2");
    font-display: block;
  }

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
