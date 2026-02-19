# LP サイト新規作成プラン

## Context

既存の LP/index.html・style.css・script.js を **完全に上書き** し、AI Solution テーマの日本語ランディングページを新規作成する。
現在のファイルは基本構造は整っているが、以下の改善が必要：

- カラー変数が仕様と異なる（`#6C63FF` → `#4F46E5 / #7C3AED` に変更）
- アニメーションが JS によるインラインスタイル変更（CSS クラスベースに移行）
- モバイルメニュー（ハンバーガー）が未実装
- Google Fonts (Noto Sans JP) のロードが未実装
- `unobserve` なしで IntersectionObserver が動作し続けるパフォーマンス問題

---

## 変更ファイル一覧

| ファイル | 操作 |
|---|---|
| `LP/index.html` | 上書き（完全新規） |
| `LP/style.css` | 上書き（完全新規） |
| `LP/script.js` | 上書き（完全新規） |

---

## 実装詳細

### 1. index.html

**`<head>` に追加**
- `<meta name="description">` (SEO)
- Google Fonts preconnect + Noto Sans JP `<link>` タグ

**ヘッダー変更**
- `.nav` 内に `<button class="hamburger" id="hamburger">` を追加（3本線ボタン）
- `</header>` 直後に `.mobile-menu#mobileMenu` を追加（モバイル用ドロワー）

**アニメーション対象要素に属性追加**
- `class="feature-card"` → `class="feature-card fade-up" data-delay="0/150/300"`
- `class="step"` → `class="step fade-up" data-delay="0/150/300"`
- `class="pricing-card"` → `class="pricing-card fade-up" data-delay="0/150/300"`
- `class="section-header"` → `class="section-header fade-up"`

---

### 2. style.css

**CSS 変数の変更（`:root`）**
```css
--primary: #4F46E5;        /* 旧: #6C63FF */
--primary-dark: #4338CA;   /* 旧: #5A52E0 */
--primary-light: #7C3AED;  /* 新規追加 */
--gradient: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
```

**フォント**
```css
body { font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif; }
```

**追加するCSSブロック**
1. `.fade-up` / `.fade-up.visible` — 初期状態 `opacity:0; translateY(28px)` → visible で解除
2. `[data-delay="150/300/450"]` — スタガーアニメーション用 transition-delay
3. `.header.scrolled` — スクロール時シャドウ（JS からクラス切り替え）
4. `.hamburger` / `.hamburger.open` — 3本線ボタン + X変形アニメーション
5. `.mobile-menu` / `.mobile-menu.open` — モバイルドロワー（display: none → flex）
6. `.mobile-link` — モバイルメニューリンクスタイル
7. `.nav a.active` — ナビアクティブ状態
8. `.cta-form input:focus` — フォーカスアウトライン
9. `@media (max-width: 768px)` に `.hamburger { display: flex; }` 追加

---

### 3. script.js（完全新規）

以下5つの機能を実装：

```
1. ヘッダースクロールシャドウ
   - scroll イベント (passive: true)
   - classList.toggle('scrolled', scrollY > 10)

2. スクロールアニメーション (IntersectionObserver)
   - .fade-up 要素を全て observe
   - isIntersecting で .visible クラス付与
   - unobserve して一度だけ発火

3. ナビアクティブハイライト (IntersectionObserver)
   - section[id] を observe
   - rootMargin: '-40% 0px -55% 0px'（中央検出帯）
   - 対応する .nav a に .active クラス付与

4. ハンバーガーメニュートグル
   - #hamburger クリックで .open クラス切り替え
   - .mobile-link クリックでメニューを閉じる

5. CTAフォーム送信
   - preventDefault でページ遷移防止
   - 送信中は button.disabled = true（二重送信防止）
   - 3秒後に元の状態に戻す
```

---

## デザイン仕様

| 項目 | 値 |
|---|---|
| Primary カラー | `#4F46E5` (Indigo 600) |
| Secondary カラー | `#7C3AED` (Violet 700) |
| ダーク | `#0F0E17` |
| グレー | `#6B7280` |
| フォント | Noto Sans JP (Google Fonts) |
| ブレークポイント | `768px` (モバイル) |

---

## セクション構成（変更なし）

1. ヘッダー (固定ナビ + ハンバーガー)
2. ヒーロー (見出し + フローティングカード + ダッシュボードモック)
3. 特徴 (3カラムグリッド)
4. 使い方 (3ステップ)
5. 料金 (3プラン)
6. CTA (メールフォーム)
7. フッター

---

## 検証方法

1. `LP/index.html` をブラウザで直接開く
2. 各セクションにスクロールし、カードのフェードアップアニメーションを確認
3. ウィンドウ幅を 768px 以下に縮め、ハンバーガーメニューの動作を確認
4. ナビリンクのアクティブハイライトがスクロール位置に連動することを確認
5. CTAフォームにメールを入力し送信ボタンを押して送信UXを確認
6. モバイルで `.hero-visual` が非表示になることを確認
