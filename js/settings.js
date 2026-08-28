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
                "5",
                "5問",
                String(
                    settings.questionCount || 10
                ) === "5"
            )}

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
        </div>
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
                    語彙、登録待ち語彙、学習履歴、設定をJSONファイルへ保存します。
                    読み込み時は、現在の語彙データを残したまま統合します。
                </p>

                <div class="settings-button-grid">
                    <button
                        id="exportDataButton"
                        class="menuButton"
                        type="button"
                    >
                        完全バックアップを書き出す
                    </button>

                    <button
                        id="importDataButton"
                        class="menuButton"
                        type="button"
                    >
                        バックアップを統合する
                    </button>
                </div>

                <div class="cloud-sync-key">
                    <label for="cloudSyncSecretInput">
                        同期キー
                    </label>

                    <input
                        id="cloudSyncSecretInput"
                        type="password"
                        autocomplete="off"
                        placeholder="同期キーを入力"
                        value="${Utils.escapeAttribute(
                            CloudSync.getSecret()
                        )}"
                    >

                    <button
                        id="saveCloudSyncSecretButton"
                        class="menuButton"
                        type="button"
                    >
                        同期キーを保存
                    </button>

                    <button
                        id="generateCloudSyncSecretButton"
                        class="menuButton"
                        type="button"
                    >
                        新しい同期キーを生成
                    </button>

                    <button
                        id="copyCloudSyncSecretButton"
                        class="menuButton"
                        type="button"
                    >
                        同期キーをコピー
                    </button>

                    <button
                        id="toggleCloudSyncSecretButton"
                        class="menuButton"
                        type="button"
                    >
                        同期キーを表示
                    </button>
                 </div>

                <div class="settings-button-grid">
                    <button
                        id="uploadCloudBackupButton"
                        class="menuButton"
                        type="button"
                    >
                        クラウドに保存
                    </button>

                    <button
                        id="downloadCloudBackupButton"
                        class="menuButton"
                        type="button"
                    >
                        クラウドから取得して統合
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
                Version ${APP_VERSION}
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

        const cloudSyncSecretInput =
            container.querySelector(
                "#cloudSyncSecretInput"
            );

        const saveCloudSyncSecretButton =
            container.querySelector(
                "#saveCloudSyncSecretButton"
            );

        saveCloudSyncSecretButton.addEventListener(
            "click",
            () => {
                const secret =
                    cloudSyncSecretInput.value
                        .trim();

                if (!secret) {
                    alert(
                        "同期キーを入力してください。"
                    );

                    return;
                }

                if (!/^[0-9a-f]{32}$/i.test(secret)) {
                    alert(
                        "同期キーは32文字の英数字（0〜9、a〜f）で入力してください。"
                    );

                    return;
                }

                CloudSync.setSecret(
                    secret
                );

                alert(
                    "同期キーをこの端末に保存しました。"
                );
            }
        );

        const generateCloudSyncSecretButton =
            container.querySelector(
                "#generateCloudSyncSecretButton"
            );

        generateCloudSyncSecretButton.addEventListener(
            "click",
            () => {
        const currentSecret =
            CloudSync.getSecret();

        const confirmed =
            confirm(
                currentSecret
                    ? (
                        "新しい同期キーを生成しますか？\n\n" +
                        "新しい同期キーは、現在とは別のクラウドデータ領域を使用します。\n" +
                        "現在の同期キーを控えていない場合、元のクラウドデータへ戻れなくなる可能性があります。"
                    )
                    : (
                        "新しい同期キーを生成しますか？\n\n" +
                        "このキーがあなたのクラウドデータを識別するために使われます。"
                    )
            );

                if (!confirmed) {
                    return;
                }

                const randomBytes =
                    new Uint8Array(16);

                crypto.getRandomValues(
                    randomBytes
                );

                const newSecret =
                    Array.from(
                        randomBytes,
                        (byte) =>
                            byte
                                .toString(16)
                                .padStart(2, "0")
                    ).join("");

                cloudSyncSecretInput.value =
                    newSecret;

                CloudSync.setSecret(
                    newSecret
                );

                alert(
                    "新しい同期キーを生成し、この端末に保存しました。\nこのキーは他の端末で同期するときに必要です。"
                );
            }
        );

        const copyCloudSyncSecretButton =
            container.querySelector(
                "#copyCloudSyncSecretButton"
            );

        copyCloudSyncSecretButton.addEventListener(
            "click",
            async () => {
                const secret =
                    cloudSyncSecretInput.value
                        .trim();

                if (!secret) {
                    alert(
                        "コピーする同期キーがありません。"
                    );

                    return;
                }

                try {
                    await navigator.clipboard.writeText(
                        secret
                    );

                    alert(
                        "同期キーをコピーしました。"
                    );
                } catch (error) {
                    console.error(error);

                    alert(
                        "同期キーをコピーできませんでした。"
                    );
                }
            }
        );

        const toggleCloudSyncSecretButton =
            container.querySelector(
                "#toggleCloudSyncSecretButton"
            );

        toggleCloudSyncSecretButton.addEventListener(
            "click",
            () => {
                const isHidden =
                    cloudSyncSecretInput.type ===
                    "password";

                cloudSyncSecretInput.type =
                    isHidden
                        ? "text"
                        : "password";

                toggleCloudSyncSecretButton.textContent =
                    isHidden
                        ? "同期キーを隠す"
                        : "同期キーを表示";
            }
        );

        const uploadCloudButton =
            container.querySelector(
                "#uploadCloudBackupButton"
            );

        uploadCloudButton.addEventListener(
            "click",
            uploadCloudBackup
        );

        const downloadCloudButton =
            container.querySelector(
                "#downloadCloudBackupButton"
            );

        downloadCloudButton.addEventListener(
            "click",
            downloadCloudBackup
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

    async function uploadCloudBackup() {
        const confirmed =
            confirm(
                "現在の学習データをクラウドへ保存しますか？\nクラウド上のバックアップは現在の端末データで更新されます。"
            );

        if (!confirmed) {
            return;
        }

        try {
            const result =
                await CloudSync.uploadBackup();

            const savedAt =
                result.cloudSavedAt
                    ? new Date(
                        result.cloudSavedAt
                    ).toLocaleString()
                    : "";

            alert(
                savedAt
                    ? `クラウドへ保存しました。\n${savedAt}`
                    : "クラウドへ保存しました。"
            );
        } catch (error) {
            console.error(error);

            alert(
                error.message ||
                "クラウドへの保存に失敗しました。"
            );
        }
    }

    async function downloadCloudBackup() {
        const confirmed =
            confirm(
                "クラウド上のバックアップを現在の端末へ統合しますか？\n現在の語彙は削除されません。"
            );

        if (!confirmed) {
            return;
        }

        try {
            const result =
                await CloudSync.downloadBackup();

            if (!result.exists) {
                alert(
                    "クラウドにバックアップがありません。"
                );

                return;
            }

            const mergeResult =
                result.mergeResult;

            const vocabulary =
                mergeResult.vocabulary;

            const pendingWords =
                mergeResult.pendingWords;

            const lines = [
                "クラウドデータを統合しました。",
                "",
                "正式語彙",
                `新規追加：${vocabulary.addedCount}語`,
                `更新：${vocabulary.updatedCount}語`,
                `変更なし：${vocabulary.skippedCount}語`,
                `統合後：${vocabulary.totalCount}語`,
                "",
                "登録待ち",
                `新規追加：${pendingWords.addedCount}語`,
                `更新：${pendingWords.updatedCount}語`,
                `変更なし：${pendingWords.skippedCount}語`,
                `統合後：${pendingWords.totalCount}語`
            ];

            alert(
                lines.join("\n")
            );

            location.reload();
        } catch (error) {
            console.error(error);

            alert(
                error.message ||
                "クラウドからの取得に失敗しました。"
            );
        }
    }

    function saveSetting(key, value) {
        Storage.updateSetting(
            key,
            value
        );
    }

  function exportLearningData() {
        const json =
            Storage.exportBackup();

        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json;charset=utf-8"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const anchor =
            document.createElement(
                "a"
            );

        const date =
            new Date()
                .toISOString()
                .slice(0, 10);

        anchor.href =
            url;

        anchor.download =
            `vocabulary-quiz-complete-backup-${date}.json`;

        document.body.appendChild(
            anchor
        );

        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(
            url
        );
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
            const confirmed =
                confirm(
                    "選択したバックアップを現在の語彙データへ統合します。\n現在の語彙は削除されません。\n続行しますか？"
                );

            if (!confirmed) {
                return;
            }

            const text =
                await file.text();

            const parsed =
                JSON.parse(text);

            validateCompleteBackup(
                parsed
            );

            const result =
                Storage.mergeBackup(
                    parsed
                );

            const vocabulary =
                result.vocabulary;

            const pendingWords =
                result.pendingWords;

            const lines = [
                "バックアップを統合しました。",
                "",
                "正式語彙",
                `新規追加：${vocabulary.addedCount}語`,
                `更新：${vocabulary.updatedCount}語`,
                `変更なし：${vocabulary.skippedCount}語`,
                `統合後：${vocabulary.totalCount}語`,
                "",
                "登録待ち",
                `新規追加：${pendingWords.addedCount}語`,
                `更新：${pendingWords.updatedCount}語`,
                `変更なし：${pendingWords.skippedCount}語`,
                `統合後：${pendingWords.totalCount}語`
            ];

            alert(
                lines.join("\n")
            );

            location.reload();
        } catch (error) {
            console.error(
                error
            );

            alert(
                error.message ||
                "バックアップを読み込めませんでした。"
            );
        } finally {
            event.target.value =
                "";
        }
    }

    function validateCompleteBackup(
        backup
    ) {
        if (
            !backup ||
            typeof backup !==
                "object" ||
            Array.isArray(
                backup
            )
        ) {
            throw new Error(
                "バックアップ形式が不正です。"
            );
        }

        const version =
            Number(
                backup.backupFormatVersion
            );

        if (version !== 2) {
            throw new Error(
                "対応していないバックアップ形式です。"
            );
        }

        if (
            !backup.data ||
            typeof backup.data !==
                "object" ||
            Array.isArray(
                backup.data
            )
        ) {
            throw new Error(
                "バックアップ内にデータがありません。"
            );
        }

        if (
            backup.data.vocabulary !==
                undefined &&
            !Array.isArray(
                backup.data.vocabulary
            )
        ) {
            throw new Error(
                "正式語彙データの形式が不正です。"
            );
        }

        if (
            backup.data.pendingWords !==
                undefined &&
            !Array.isArray(
                backup.data.pendingWords
            )
        ) {
            throw new Error(
                "登録待ち語彙データの形式が不正です。"
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