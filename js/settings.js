"use strict";

const Settings = (() => {
    function render(container) {
        const settings =
            Storage.getSettings();

        container.innerHTML = `
            <section class="card settings-header">
                <div class="page-heading">
                    <div>
                        <p class="eyebrow">
                            SETTINGS
                        </p>

                        <h2>
                            設定
                        </h2>

                        <p class="page-description">
                            クイズの出題方法や表示を変更できます。
                        </p>
                    </div>

                    <button
                        id="settingsHomeButton"
                        class="menuButton compact-button"
                        type="button"
                    >
                        ホームへ戻る
                    </button>
                </div>
            </section>

            <section class="card settings-section">
                <h3>
                    問題数
                </h3>

                <p class="settings-description">
                    通常クイズで出題する問題数を選択します。
                </p>

                <div class="settings-options">
                    ${createRadioOption(
                        "questionCount",
                        "10",
                        "10問",
                        String(
                            settings.questionCount || 10
                        ) === "10"
                    )}

                    ${createRadioOption(
                        "questionCount",
                        "20",
                        "20問",
                        String(
                            settings.questionCount || 10
                        ) === "20"
                    )}

                    ${createRadioOption(
                        "questionCount",
                        "30",
                        "30問",
                        String(
                            settings.questionCount || 10
                        ) === "30"
                    )}
                </div>
            </section>

            <section class="card settings-section">
                <h3>
                    読み問題
                </h3>

                <p class="settings-description">
                    漢字を含む語について、読みを問う問題を出題します。
                    カタカナ語や英字語の読み問題は出題されません。
                </p>

                <label class="toggle-row">
                    <span>
                        読み問題を出題する
                    </span>

                    <input
                        id="readingQuizToggle"
                        type="checkbox"
                        ${
                            settings.readingQuiz !== false
                                ? "checked"
                                : ""
                        }
                    >

                    <span
                        class="toggle-switch"
                        aria-hidden="true"
                    ></span>
                </label>
            </section>

            <section class="card settings-section">
                <h3>
                    表示テーマ
                </h3>

                <p class="settings-description">
                    画面の明るさを選択します。
                </p>

                <div class="settings-options">
                    ${createRadioOption(
                        "theme",
                        "auto",
                        "端末設定に合わせる",
                        (
                            settings.darkMode ||
                            "auto"
                        ) === "auto"
                    )}

                    ${createRadioOption(
                        "theme",
                        "light",
                        "ライト",
                        settings.darkMode ===
                            "light"
                    )}

                    ${createRadioOption(
                        "theme",
                        "dark",
                        "ダーク",
                        settings.darkMode ===
                            "dark"
                    )}
                </div>
            </section>

            <section class="card settings-section">
                <h3>
                    アニメーション
                </h3>

                <label class="toggle-row">
                    <span>
                        画面切り替えのアニメーション
                    </span>

                    <input
                        id="animationToggle"
                        type="checkbox"
                        ${
                            settings.animation !== false
                                ? "checked"
                                : ""
                        }
                    >

                    <span
                        class="toggle-switch"
                        aria-hidden="true"
                    ></span>
                </label>
            </section>

            <section class="card settings-section">
                <h3>
                    学習データ
                </h3>

                <p class="settings-description">
                    学習履歴や設定をファイルへ保存し、
                    別の端末で復元できます。
                </p>

                <div class="settings-button-grid">
                    <button
                        id="exportDataButton"
                        class="menuButton"
                        type="button"
                    >
                        バックアップを書き出す
                    </button>

                    <button
                        id="importDataButton"
                        class="menuButton"
                        type="button"
                    >
                        バックアップを復元する
                    </button>

                    <input
                        id="importDataInput"
                        class="hidden"
                        type="file"
                        accept="application/json,.json"
                    >
                </div>
            </section>

            <section class="card settings-section danger-zone">
                <h3>
                    学習履歴の初期化
                </h3>

                <p class="settings-description">
                    正答数、誤答数、お気に入りなどをすべて削除します。
                    この操作は取り消せません。
                </p>

                <button
                    id="resetDataButton"
                    class="danger-button"
                    type="button"
                >
                    学習履歴をすべて削除
                </button>
            </section>

            <section class="app-version">
                Vocabulary Quiz
                <strong>
                    Version 0.7.0
                </strong>
            </section>
        `;

        bindEvents(container);
    }

    function createRadioOption(
        name,
        value,
        label,
        checked
    ) {
        return `
            <label class="radio-option">
                <input
                    type="radio"
                    name="${Utils.escapeAttribute(name)}"
                    value="${Utils.escapeAttribute(value)}"
                    ${checked ? "checked" : ""}
                >

                <span>
                    ${Utils.escapeHtml(label)}
                </span>
            </label>
        `;
    }

    function bindEvents(container) {
        container
            .querySelector(
                "#settingsHomeButton"
            )
            .addEventListener(
                "click",
                () => Router.show("home")
            );

        container
            .querySelectorAll(
                'input[name="questionCount"]'
            )
            .forEach((input) => {
                input.addEventListener(
                    "change",
                    () => {
                        saveSetting(
                            "questionCount",
                            Number(input.value)
                        );
                    }
                );
            });

        container
            .querySelector(
                "#readingQuizToggle"
            )
            .addEventListener(
                "change",
                (event) => {
                    saveSetting(
                        "readingQuiz",
                        event.target.checked
                    );
                }
            );

        container
            .querySelectorAll(
                'input[name="theme"]'
            )
            .forEach((input) => {
                input.addEventListener(
                    "change",
                    () => {
                        saveSetting(
                            "darkMode",
                            input.value
                        );

                        document
                            .documentElement
                            .dataset
                            .theme =
                            input.value;
                    }
                );
            });

        container
            .querySelector(
                "#animationToggle"
            )
            .addEventListener(
                "change",
                (event) => {
                    const enabled =
                        event.target.checked;

                    saveSetting(
                        "animation",
                        enabled
                    );

                    document
                        .documentElement
                        .classList
                        .toggle(
                            "reduce-motion",
                            !enabled
                        );
                }
            );

        container
            .querySelector(
                "#exportDataButton"
            )
            .addEventListener(
                "click",
                exportLearningData
            );

        const importButton =
            container.querySelector(
                "#importDataButton"
            );

        const importInput =
            container.querySelector(
                "#importDataInput"
            );

        importButton.addEventListener(
            "click",
            () => importInput.click()
        );

        importInput.addEventListener(
            "change",
            importLearningData
        );

        container
            .querySelector(
                "#resetDataButton"
            )
            .addEventListener(
                "click",
                resetLearningData
            );
    }

    function saveSetting(key, value) {
        Storage.updateSetting(
            key,
            value
        );
    }

    function exportLearningData() {
        const json =
            Storage.export();

        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json"
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
            `vocabulary-quiz-backup-${date}.json`;

        document.body.appendChild(
            anchor
        );

        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }

    async function importLearningData(
        event
    ) {
        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        try {
            const text =
                await file.text();

            const parsed =
                JSON.parse(text);

            validateBackup(parsed);

            Storage.import(text);

            alert(
                "バックアップを復元しました。"
            );

            location.reload();
        } catch (error) {
            alert(
                "バックアップを読み込めませんでした。"
            );
        } finally {
            event.target.value = "";
        }
    }

    function validateBackup(data) {
        if (
            !data ||
            typeof data !== "object"
        ) {
            throw new Error(
                "バックアップ形式が不正です。"
            );
        }

        if (
            data.stats &&
            typeof data.stats !== "object"
        ) {
            throw new Error(
                "学習履歴の形式が不正です。"
            );
        }

        if (
            data.settings &&
            typeof data.settings !==
                "object"
        ) {
            throw new Error(
                "設定の形式が不正です。"
            );
        }
    }

    function resetLearningData() {
        const confirmed =
            confirm(
                "学習履歴と設定をすべて削除します。よろしいですか？"
            );

        if (!confirmed) {
            return;
        }

        const secondConfirmed =
            confirm(
                "この操作は取り消せません。本当に削除しますか？"
            );

        if (!secondConfirmed) {
            return;
        }

        Storage.reset();

        alert(
            "学習履歴を削除しました。"
        );

        location.reload();
    }

    return {
        render
    };
})();