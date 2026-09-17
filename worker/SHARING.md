# 語彙のコード共有

サイトの「設定」→「語彙の追加・共有」→「語彙を共有」から利用します。

- 意味の登録済み語彙を、名前付きのスナップショットとして公開します。上限は2,000語・JSON全体1MBです。
- 24桁のランダムな数字を発行します。コピー時は4桁ずつハイフンで区切ります。入力時は空白・ハイフン・全角数字にも対応します。
- 公開内容は語彙・読み・意味・補足説明・カテゴリ・出題形式・出典のみです。語彙ID、学習履歴、お気に入り、同期キー、登録待ちは含めません。
- 再アップロードは別のコードになります。公開済みの内容は変わりません。
- 取得前に全語彙のプレビュー、追加予定数、重複数を表示します。同じ見出しの登録済み・登録待ち語彙は上書きしません。
- 追加した語だけに `packId: shared-<code>` をローカルで付けます。取り込み元が送ったIDやパックIDは採用しません。
- セット削除はそのpackIdを持つ語と対応する語別学習記録だけを削除します。既存の語や他の共有セットは残ります。取り込み後に編集した語もセットに所属したままです。
- 共有セットの所属情報は語彙の一部なので既存のバックアップ／同期にも含まれます。

## 公開元

コードを知っている人は取得できます。公開セットの一覧取得APIはありません。公開者は発行時に受け取る256bitの管理用トークンで公開停止できます。トークンはこのブラウザーの `vocabularyQuizPublishedSharesV1` に保存し、サーバーにはSHA-256のハッシュだけを保存します。GET応答にも公開データにも含めません。

公開履歴・管理用トークンはクラウド同期やバックアップの対象外です。元ブラウザーの保存データを消すと公開停止できなくなる旨を画面に表示しています。公開停止後も他の人が保存済みの語彙は残ります。公開停止は匿名GETを即座に404にします（D1のプライマリー参照、HTTPキャッシュなし）。

## サーバー

- Worker: `vocabulary-sharing`
- API: `https://vocabulary-sharing.pennyroyal-juice.workers.dev`
- D1: `vocabulary-shares` / binding `DB`
- `GET /health`: releaseとテーブルの利用可否
- `POST /shares`: `{name, words}` → `{code, name, count, createdAt, deleteToken}`
- `GET /shares/<code>`: `{code, name, createdAt, words}`
- `DELETE /shares/<code>`: `X-Delete-Token` で公開停止

入力はブラウザー／サーバー共通の `js/share-format.js` で許可フィールドに限定します。受信本文はストリームで1MBに制限します。SQLはパラメーター化し、コードは主キー制約と `INSERT OR IGNORE` により衝突時に再発行します。APIにはCloudflareのIP単位のレート制限を設定しています（公開5回/分、その他60回/分、各拠点での制限）。認証付きのユーザーアカウント機能ではありません。

## 配備・確認

```powershell
npm exec --yes --package=wrangler -- wrangler d1 execute vocabulary-shares --remote --file worker/sharing-schema.sql --config worker/wrangler-sharing.jsonc
npm exec --yes --package=wrangler -- wrangler deploy --config worker/wrangler-sharing.jsonc
node --test tests/vocabulary-sharing.test.mjs tests/word-packs.test.mjs
```

単体・結合テストではインメモリーSQLiteで実際のSQLを実行し、分離したローカルストレージで重複・削除・バックアップ互換を確認します。

`tests/sharing-browser.cjs` はPlaywrightとMicrosoft Edgeを使用する画面テストです。`VOCAB_TEST_URL` でテストするサイト、`VOCAB_TEST_PLAYWRIGHT` でPlaywrightモジュールのパスを指定できます（既定サイトは `http://127.0.0.1:5500`）。新しいブラウザーコンテキストに架空の2語だけを入れ、本番APIへの公開から取り込み・削除・公開停止まで実行します。テスト中に作った公開セットは最後に削除します。利用者のブラウザーデータは使いません。

Cloudflare参考資料：[D1の上限](https://developers.cloudflare.com/d1/platform/limits/)、[Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)。
