# Vocabulary Quiz

苦手な語ほど出題されやすい、個人用の語彙学習アプリです。

登録した語彙について、意味・単語・読みを問う四択クイズを繰り返し遊べます。学習履歴はブラウザ内に保存され、誤答した語や正答率の低い語が優先的に出題されます。

## 主な機能

- 毎回変わる四択クイズ
- 意味から単語を答える問題
- 単語から意味を答える問題
- 漢字を含む語の読み問題
- カタカナ語・英字語の読み問題を除外
- 読み問題の回答後にも意味を表示
- 苦手語・未出題語を優先する重み付き出題
- 復習ノート
- 苦手ランキング
- 五十音順の語彙一覧
- 語彙・読み・意味・カテゴリ検索
- お気に入り
- 学習統計
- 今日の学習進捗
- 問題数設定
- 読み問題のON・OFF
- ライト・ダークテーマ
- 学習データのバックアップと復元

## 使用技術

- HTML
- CSS
- Vanilla JavaScript
- JSON
- LocalStorage
- GitHub Pages

ビルドツールや外部ライブラリは使用していません。

## ディレクトリ構成

```text
vocabulary-quiz/
├── index.html
├── README.md
├── css/
│   └── style.css
├── data/
│   └── words.json
└── js/
    ├── app.js
    ├── dictionary.js
    ├── quiz.js
    ├── review.js
    ├── router.js
    ├── settings.js
    ├── statistics.js
    ├── storage.js
    └── utils.js