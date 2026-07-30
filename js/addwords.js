"use strict";

const AddWords = (() => {
    let standardWords = [];

    function render(container, words) {
        standardWords =
            Array.isArray(words)
                ? [...words]
                : [];

        renderPage(container);
    }

    function renderPage(container) {
        const customWords =
            Storage.getCustomWords();

        const pendingWords =
            customWords.filter(
                (item) =>
                    item.status !== "ready"
            );

        const readyWords =
            customWords.filter(
                (item) =>
                    item.status === "ready"
            );

        container.innerHTML = `
            <section class="card">
                <div class="page-heading">
                    <div>
                        <p class="eyebrow">
                            ADD VOCABULARY
                        </p>

                        <h2>
                            語彙を追加
                        </h2>

                        <p class="page-description">
                            1行に1語ずつ入力してください。
                            括弧内のメモは自動的に除去されます。
                        </p>
                    </div>

                    <button
                        id="addWordsHomeButton"
                        class="menuButton compact-button"
                        type="button"
                    >
                        ホームへ戻る
                    </button>
                </div>
            </section>

            <section class="card add-words-form">
                <label for="newWordsInput">
                    追加する語彙
                </label>

                <textarea
                    id="newWordsInput"
                    class="words-textarea"
                    rows="8"
                    placeholder="嚆矢
シニフィアン
フォートナイト"
                ></textarea>

                <p class="settings-description">
                    既存語彙および追加済み語彙との重複は除外されます。
                </p>

                <button
                    id="checkNewWordsButton"
                    class="primary"
                    type="button"
                >
                    重複を確認して登録
                </button>

                <div
                    id="addWordsResult"
                    class="add-words-result hidden"
                    aria-live="polite"
                ></div>
            </section>

            <section class="card">
                <div class="pending-heading">
                    <div>
                        <h3>
                            登録待ち
                        </h3>

                        <p class="page-description">
                            読み・意味・カテゴリを入力し、
                            「確定してクイズに追加」を押してください。
                        </p>
                    </div>

                    <strong>
                        ${pendingWords.length}語
                    </strong>
                </div>

                <div id="pendingWordsList">
                    ${createPendingWordsList(
                        pendingWords
                    )}
                </div>
            </section>

            <section class="card">
                <div class="pending-heading">
                    <div>
                        <h3>
                            追加済み語彙
                        </h3>

                        <p class="page-description">
                            ブラウザ内に保存され、
                            クイズと語彙一覧に反映されます。
                        </p>
                    </div>

                    <strong>
                        ${readyWords.length}語
                    </strong>
                </div>

                <div>
                    ${createReadyWordsList(
                        readyWords
                    )}
                </div>
            </section>

            <section class="card export-master-section">
                <div class="pending-heading">
                    <div>
                        <h3>
                            語彙テキスト出力
                        </h3>

                        <p class="page-description">
                            標準語彙と、確定済みの追加語彙を統合し、
                            1行1語のTXTファイルとして書き出します。
                        </p>
                    </div>

                    <button
                        id="exportMasterTextButton"
                        class="primary compact-primary"
                        type="button"
                    >
                        マスターテキストを書き出す
                    </button>
                </div>
            </section>
        `;

        bindEvents(container);
    }

    function bindEvents(container) {
        container
            .querySelector(
                "#addWordsHomeButton"
            )
            .addEventListener(
                "click",
                () => Router.show("home")
            );

        container
            .querySelector(
                "#checkNewWordsButton"
            )
            .addEventListener(
                "click",
                () => registerWords(container)
            );

            const exportMasterButton =
                container.querySelector(
                    "#exportMasterTextButton"
                );

            if (exportMasterButton) {
                exportMasterButton.addEventListener(
                    "click",
                    exportMasterText
                );
            }

        container
            .querySelectorAll(
                "[data-save-custom-word]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => saveCustomWord(
                        container,
                        button.dataset
                            .saveCustomWord,
                        false
                    )
                );
            });

        container
            .querySelectorAll(
                "[data-finalize-custom-word]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => saveCustomWord(
                        container,
                        button.dataset
                            .finalizeCustomWord,
                        true
                    )
                );
            });

        container
            .querySelectorAll(
                "[data-delete-custom-word]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => deleteCustomWord(
                        container,
                        button.dataset
                            .deleteCustomWord
                    )
                );
            });
    }

    function registerWords(container) {
        const textarea =
            container.querySelector(
                "#newWordsInput"
            );

        const resultBox =
            container.querySelector(
                "#addWordsResult"
            );

        const candidates =
            textarea.value
                .split(/\r?\n/u)
                .map((line) => line.trim())
                .filter(Boolean);

        if (!candidates.length) {
            showMessage(
                resultBox,
                "追加する語彙を入力してください。",
                "warning"
            );

            return;
        }

        const standardKeys =
            new Map(
                standardWords.map(
                    (item) => [
                        Storage.normalizeWordKey(
                            item.word
                        ),
                        item.word
                    ]
                )
            );

        const newCandidates = [];
        const standardDuplicates = [];

        for (const candidate of candidates) {
            const key =
                Storage.normalizeWordKey(
                    candidate
                );

            if (!key) {
                continue;
            }

            if (standardKeys.has(key)) {
                standardDuplicates.push(
                    standardKeys.get(key)
                );
            } else {
                newCandidates.push(
                    candidate
                );
            }
        }

        const result =
            Storage.addPendingWords(
                newCandidates
            );

        const duplicateWords = [
            ...standardDuplicates,
            ...result.duplicates
        ];

        resultBox.classList.remove(
            "hidden"
        );

        resultBox.innerHTML = `
            <div class="add-result-section success-result">
                <strong>
                    新規登録：
                    ${result.added.length}語
                </strong>

                ${createSimpleList(
                    result.added.map(
                        (item) => item.word
                    )
                )}
            </div>

            <div class="add-result-section duplicate-result">
                <strong>
                    重複のため除外：
                    ${duplicateWords.length}語
                </strong>

                ${createSimpleList(
                    [...new Set(
                        duplicateWords
                    )]
                )}
            </div>
        `;

        textarea.value = "";

        refreshLists(container);
    }

    function saveCustomWord(
        container,
        wordId,
        finalize
    ) {
        const card =
            container.querySelector(
                `[data-custom-word-card="${CSS.escape(
                    String(wordId)
                )}"]`
            );

        if (!card) {
            return;
        }

        const word =
            card.querySelector(
                '[data-field="word"]'
            ).value.trim();

        const reading =
            card.querySelector(
                '[data-field="reading"]'
            ).value.trim();

        const meaning =
            card.querySelector(
                '[data-field="meaning"]'
            ).value.trim();

        const description =
            card.querySelector(
                '[data-field="description"]'
            ).value.trim();

        const category =
            card.querySelector(
                '[data-field="category"]'
            ).value.trim();

        const selectedQuizTypes =
            Array.from(
                card.querySelectorAll(
                    "[data-quiz-type]:checked"
                )
            ).map(
                (input) =>
                    input.dataset.quizType
            );
            
        const message =
            card.querySelector(
                ".custom-word-message"
            );

        if (!word) {
            showMessage(
                message,
                "語彙を入力してください。",
                "warning"
            );
            return;
        }

        if (finalize && !meaning) {
            showMessage(
                message,
                "確定するには意味が必要です。",
                "warning"
            );
            return;
        }

        const duplicate =
            findDuplicate(
                word,
                wordId
            );

        if (duplicate) {
            showMessage(
                message,
                `「${duplicate}」と重複しています。`,
                "warning"
            );
            return;
        }

        const quizTypes =
            createQuizTypes({
                word,
                reading,
                category
            });

        Storage.updateCustomWord(
            wordId,
            {
                word,
                reading,
                meaning,
                description,
                category:
                    category || "未分類",
                quizTypes,
                status:
                    finalize
                        ? "ready"
                        : "pending",
                updatedAt:
                    Date.now()
            }
        );

        if (finalize) {
            alert(
                `「${word}」をクイズへ追加しました。ページを再読み込みすると反映されます。`
            );

            location.reload();
            return;
        }

        showMessage(
            message,
            "下書きを保存しました。",
            "success"
        );
    }

    function findDuplicate(
        word,
        currentId
    ) {
        const key =
            Storage.normalizeWordKey(word);

        const standardMatch =
            standardWords.find(
                (item) =>
                    Storage.normalizeWordKey(
                        item.word
                    ) === key
            );

        if (standardMatch) {
            return standardMatch.word;
        }

        const customMatch =
            Storage.getCustomWords()
                .find(
                    (item) =>
                        String(item.id) !==
                            String(currentId) &&
                        Storage.normalizeWordKey(
                            item.word
                        ) === key
                );

        return customMatch
            ? customMatch.word
            : "";
    }

    function createQuizTypes({
        word,
        reading,
        category
    }) {
        const types = [
            "wordToMeaning",
            "meaningToWord"
        ];

        const hasKanji =
            /[\u3400-\u9FFF々〆ヵヶ]/u
                .test(word);

        const excludedCategory =
            [
                "慣用句",
                "ことわざ",
                "婉曲表現",
                "成句"
            ].some(
                (value) =>
                    String(category)
                        .includes(value)
            );

        const sentenceLike =
            /(?:が|を|に|へ|と|の|は|も|で|から|まで)/u
                .test(word) &&
            word.length >= 6;

        if (
            reading &&
            hasKanji &&
            !excludedCategory &&
            !sentenceLike
        ) {
            types.push("reading");
        }

        return types;
    }

    function deleteCustomWord(
        container,
        wordId
    ) {
        const confirmed =
            confirm(
                "この追加語彙を削除しますか？"
            );

        if (!confirmed) {
            return;
        }

        Storage.removeCustomWord(
            wordId
        );

        refreshLists(container);
    }

    function refreshLists(container) {
        renderPage(container);
    }

    function createPendingWordsList(
        words
    ) {
        if (!words.length) {
            return `
                <div class="empty-state">
                    <p>
                        登録待ちの語彙はありません。
                    </p>
                </div>
            `;
        }

        return `
            <div class="custom-word-editor-list">
                ${words
                    .slice()
                    .sort(
                        (a, b) =>
                            Number(b.createdAt) -
                            Number(a.createdAt)
                    )
                    .map(
                        createEditorCard
                    )
                    .join("")}
            </div>
        `;
    }

    function createEditorCard(item) {
        const quizTypes =
            Array.isArray(item.quizTypes)
                ? item.quizTypes
                : [];

        return `
            <article
                class="custom-word-editor"
                data-custom-word-card="${Utils.escapeAttribute(
                    item.id
                )}"
            >
                <div class="confirmation-card-heading">
                    <div>
                        <p class="eyebrow">
                            CONFIRM VOCABULARY
                        </p>

                        <h3>
                            生成内容の確認
                        </h3>
                    </div>

                    <span class="pending-status">
                        ${
                            item.status === "generated"
                                ? "生成済み"
                                : "入力待ち"
                        }
                    </span>
                </div>

                <p class="settings-description">
                    内容を確認し、必要に応じて修正してから登録してください。
                </p>

                <div class="custom-word-fields">
                    ${createInputField(
                        "語彙",
                        "word",
                        item.word,
                        true
                    )}

                    ${createInputField(
                        "読み",
                        "reading",
                        item.reading
                    )}

                    ${createTextareaField(
                        "意味",
                        "meaning",
                        item.meaning
                    )}

                    ${createTextareaField(
                        "補足説明",
                        "description",
                        item.description
                    )}

                    ${createInputField(
                        "カテゴリ",
                        "category",
                        item.category
                    )}

                    <fieldset class="quiz-type-editor">
                        <legend>
                            問題形式
                        </legend>

                        ${createQuizTypeCheckbox(
                            "wordToMeaning",
                            "単語から意味を選ぶ",
                            quizTypes.includes(
                                "wordToMeaning"
                            ) ||
                            quizTypes.length === 0
                        )}

                        ${createQuizTypeCheckbox(
                            "meaningToWord",
                            "意味から単語を選ぶ",
                            quizTypes.includes(
                                "meaningToWord"
                            ) ||
                            quizTypes.length === 0
                        )}

                        ${createQuizTypeCheckbox(
                            "reading",
                            "読みを選ぶ",
                            quizTypes.includes(
                                "reading"
                            )
                        )}
                    </fieldset>
                </div>

                <p
                    class="custom-word-message hidden"
                    aria-live="polite"
                ></p>

                <div class="custom-word-actions">
                    <button
                        class="secondary-button"
                        type="button"
                        data-regenerate-custom-word="${Utils.escapeAttribute(
                            item.id
                        )}"
                        disabled
                        title="AI接続後に利用できます"
                    >
                        AIで再生成
                    </button>

                    <button
                        class="menuButton"
                        type="button"
                        data-save-custom-word="${Utils.escapeAttribute(
                            item.id
                        )}"
                    >
                        下書きを保存
                    </button>

                    <button
                        class="primary"
                        type="button"
                        data-finalize-custom-word="${Utils.escapeAttribute(
                            item.id
                        )}"
                    >
                        確定して登録
                    </button>

                    <button
                        class="delete-word-button"
                        type="button"
                        data-delete-custom-word="${Utils.escapeAttribute(
                            item.id
                        )}"
                    >
                        削除
                    </button>
                </div>
            </article>
        `;
    }

      function createQuizTypeCheckbox(
            value,
            label,
            checked
        ) {
            return `
                <label class="quiz-type-option">
                    <input
                        type="checkbox"
                        data-quiz-type="${Utils.escapeAttribute(
                            value
                        )}"
                        ${checked ? "checked" : ""}
                    >

                    <span>
                        ${Utils.escapeHtml(label)}
                    </span>
                </label>
            `;
        }

    function createReadyWordsList(words) {
        if (!words.length) {
            return `
                <div class="empty-state">
                    <p>
                        追加済みの語彙はありません。
                    </p>
                </div>
            `;
        }

        return `
            <div class="pending-words-list">
                ${words
                    .map(
                        (item) => `
                            <article class="pending-word-item">
                                <div>
                                    <strong>
                                        ${Utils.escapeHtml(
                                            item.word
                                        )}
                                    </strong>

                                    <small>
                                        ${Utils.escapeHtml(
                                            item.reading ||
                                            item.category ||
                                            "追加済み"
                                        )}
                                    </small>
                                </div>

                                <button
                                    class="delete-word-button"
                                    type="button"
                                    data-delete-custom-word="${Utils.escapeAttribute(
                                        item.id
                                    )}"
                                >
                                    削除
                                </button>
                            </article>
                        `
                    )
                    .join("")}
            </div>
        `;
    }

    function createInputField(
        label,
        field,
        value,
        required = false
    ) {
        return `
            <label class="custom-field">
                <span>
                    ${Utils.escapeHtml(label)}
                    ${required ? " *" : ""}
                </span>

                <input
                    type="text"
                    data-field="${Utils.escapeAttribute(
                        field
                    )}"
                    value="${Utils.escapeAttribute(
                        value || ""
                    )}"
                >
            </label>
        `;
    }

    function createTextareaField(
        label,
        field,
        value
    ) {
        return `
            <label class="custom-field">
                <span>
                    ${Utils.escapeHtml(label)}
                </span>

                <textarea
                    rows="3"
                    data-field="${Utils.escapeAttribute(
                        field
                    )}"
                >${Utils.escapeHtml(
                    value || ""
                )}</textarea>
            </label>
        `;
    }

    function createSimpleList(values) {
        if (!values.length) {
            return "";
        }

        return `
            <ul>
                ${values
                    .map(
                        (value) => `
                            <li>
                                ${Utils.escapeHtml(
                                    value
                                )}
                            </li>
                        `
                    )
                    .join("")}
            </ul>
        `;
    }

    function showMessage(
        element,
        message,
        type
    ) {
        element.className =
            `custom-word-message ${type}-message`;

        element.textContent =
            message;
    }

    function exportMasterText() {
        const customWords =
            Storage.getReadyCustomWords();

        const combinedWords = [
            ...standardWords,
            ...customWords
        ];

        const seen = new Set();

        const uniqueWords =
            combinedWords
                .filter((item) => {
                    const key =
                        Storage.normalizeWordKey(
                            item.word
                        );

                    if (
                        !key ||
                        seen.has(key)
                    ) {
                        return false;
                    }

                    seen.add(key);
                    return true;
                })
                .map((item) =>
                    String(item.word).trim()
                )
                .filter(Boolean);

        if (!uniqueWords.length) {
            alert(
                "書き出せる語彙がありません。"
            );

            return;
        }

        const text =
            uniqueWords.join("\r\n") +
            "\r\n";

        // Windowsのメモ帳やExcelで文字化けしにくいようBOMを付ける
        const blob =
            new Blob(
                [
                    "\uFEFF",
                    text
                ],
                {
                    type:
                        "text/plain;charset=utf-8"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const anchor =
            document.createElement("a");

        const date =
            new Date()
                .toISOString()
                .slice(0, 10);

        anchor.href = url;
        anchor.download =
            `words_master_${date}.txt`;

        document.body.appendChild(
            anchor
        );

        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }

    return {
        render
    };
})();