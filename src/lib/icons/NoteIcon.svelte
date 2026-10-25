<!--
	NoteIcon.svelte
	音符のアイコン（ICOOON MONO の素材）
	ホームの「読む」のカード、ステップ7でファビコン・ホーム画面用の画像・OGP画像にも使う
	- 色は「currentColor」＝まわりの文字の色（CSS の color）になる
	  使う側で color を指定すれば、好きな色に変えられる
	- 大きさは size で指定する（ピクセル。たて・よこ同じ）

	使い方の例：<NoteIcon size={40} />
	利用規約：https://icooon-mono.com/license/
	（アプリへの組み込み・加工は自由、クレジット表記は不要。アイコン自体の再配布は禁止）
-->
<script>
  // size … アイコンの大きさ（ピクセル）。指定しなければ 24
  let { size = 24 } = $props();
</script>

<!--
	viewBox="0 0 512 512" … もとの素材の座標の範囲（512×512 の正方形）
	aria-hidden="true"    … 飾りなので、読み上げソフトには読ませない
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
  <path
    d="M340.078-0.004v311.078c-23.641-9.969-52.828-14.047-84.422-10.125 c-78.516,9.75-141.969,64.594-141.766,122.407c0.203,57.875,64,96.906,142.469,87.156c78.5-9.766,141.953-64.594,141.75-122.469 V-0.004H340.078z"
  />
</svg>

<style>
  svg {
    /* 文字と並べたときに、下にすき間ができないようにする */
    display: block;
    /* 縮まないようにする（ボタンの中などで、つぶれないように） */
    flex-shrink: 0;
  }
</style>
