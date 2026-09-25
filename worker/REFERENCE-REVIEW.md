# 辞書参照と翻訳校正（2026-09-25）

公開識別子：`2026-09-25-reference-review-v5`

- 日本語版ウィクショナリーで得た読み・定義を優先する。複数語義の選択に失敗した場合は先頭候補を返さず422にする。
- 英語語釈の翻訳後、別のAI呼び出しで原文・見出し語・読み・文脈と照合する。文化・宗教・専門分野の取り違え、根拠のない限定などを検査する。不承認なら理由を添えて翻訳を一度やり直す。校正が失敗・応答不正なら未確認の翻訳は返さない。
- 校正も同じモデルを使うため、独立した辞書による二重確認や正確性の保証ではない。日本語辞書にある語義自体の正誤をすべて検証する仕組みでもない。
- 報告された「御斎」は、確認済みの学習用定義を優先する。「お斎」「御齋」も対応。読みは「おとき」。誤った読みの指定時は422にする。内容は仏事の食事として書き起こし、英訳を介さず返す。
- 確認資料：[新纂浄土宗大辞典](https://jodoshuzensho.jp/daijiten/index.php/御斎)、[天台宗の解説](https://www.tendai.or.jp/qa/11.html)。参照リンクはsourcesに保持する。
- コトバンクの自動取得は未実装。確認時点で一般公開APIは見つからず、[利用規約](https://kotobank.jp/rule/)のデータ利用条件を踏まえ、常時取り込みは採用していない。

検証：`node --test worker/vocabulary-generator.test.mjs worker/japanese-reference.test.mjs worker/reference-review.test.mjs`

公開：`wrangler deploy --config worker/wrangler-generator.jsonc --keep-vars`

既存の保存語彙は自動上書きしない。利用者が再生成した場合に新処理を適用する。
