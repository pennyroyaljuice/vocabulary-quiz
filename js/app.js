"use strict";

const APP_VERSION = "0.9.0";

const AI_API_URL =
    "https://vocabulary-generator.pennyroyal-juice.workers.dev/";

const App = (() => {
    let words = [];
    let quizAnswerViewState = null;
    let currentQuizMode = "normal";

    async function init() {
        try {
            words = await loadWords();

            updateHeaderWordCount();

            updateVersionDisplay();

            Quiz.initialize(words);

            registerRoutes();
            bindGlobalEvents();
            applySettings();

            Router.show("home");
        } catch (error) {
            renderFatalError(error);
        }
    }

    async function loadWords() {
        const storageData =
            Storage.load();

        const vocabulary =
            Array.isArray(
                storageData.vocabulary
            )
                ? storageData.vocabulary
                : [];

        return vocabulary
            .filter(
                (item) =>
                    item &&
                    item.word &&
                    item.meaning
            )
            .map(
                normalizeCustomWord
            );
    }

    async function resumeQuizAfterEdit() {
        words =
            await loadWords();

        updateHeaderWordCount();

        quizAnswerViewState = null;

        Quiz.recreateCurrentQuestion(
            words
        );

        Router.show(
            "quiz"
        );
    }

    async function reloadWords() {
        words =
            await loadWords();

        updateHeaderWordCount();

        Quiz.initialize(
            words
        );

        return [
            ...words
        ];
    }

    function normalizeCustomWord(
        item
    ) {
        return {
            id:
                String(item.id),

            word:
                String(
                    item.word || ""
                ).trim(),

            reading:
                String(
                    item.reading || ""
                ).trim(),

            meaning:
                String(
                    item.meaning || ""
                ).trim(),

            description:
                String(
                    item.description || ""
                ).trim(),

            category:
                String(
                    item.category ||
                    "未分類"
                ).trim(),

            quizTypes:
                Array.isArray(
                    item.quizTypes
                )
                    ? [...item.quizTypes]
                    : [],

             sources:
                Array.isArray(
                    item.sources
                )
                    ? item.sources.map(
                        (source) => ({
                            title:
                                String(
                                    source?.title ||
                                    ""
                                ).trim(),

                            url:
                                String(
                                    source?.url ||
                                    ""
                                ).trim()
                        })
                    )
                    : [],

            comparisonNote:
                String(
                    item.comparisonNote ||
                    ""
                ).trim(),

            needsReview:
                item.needsReview !==
                false,

            source:
                "custom",

            status:
                item.status ||
                "ready",

            createdAt:
                item.createdAt ||
                null,

            updatedAt:
                item.updatedAt ||
                null
        };
    }

    function updateHeaderWordCount() {
        const element =
            document.getElementById(
                "word-count"
            );

        if (element) {
            element.textContent =
                `${words.length} Words`;
        }
    }

    function updateVersionDisplay() {
        const footerVersion =
            document.getElementById(
                "footerVersion"
            );

        if (footerVersion) {
            footerVersion.textContent =
                `Version ${APP_VERSION}`;
        }
    }

    function registerRoutes() {

        Router.register(
             "addWords",
            (container) =>
            AddWords.render(
            container,
            words
                          )
        );

        Router.register(
            "editCustomWord",
            (container, params) =>
                AddWords.renderEditor(
                    container,
                    words,
                    params.wordId
                )
        );

        Router.register(
            "editWord",
            (container, params) =>
                AddWords.renderUnifiedEditor(
                    container,
                    words,
                    params.wordId,
                    params
                )
        );

        Router.register(
            "home",
            renderHome
        );

        Router.register(
            "quiz",
            renderQuizRoute
        );

        Router.register(
            "result",
            renderResultRoute
        );

        Router.register(
              "review",
             (container, params) =>
           Review.render(
            container,
            words,
            params
            )
        );

        Router.register(
            "dictionary",
            (container, params) =>
                Dictionary.render(
                    container,
                    words,
                    params
                )
        );

        Router.register(
            "statistics",
            (container) =>
                Statistics.render(
                    container,
                    words
                )
        );

        Router.register(
            "settings",
            (container) =>
                Settings.render(
                    container
                )
        );
    }

    function bindGlobalEvents() {
        document.addEventListener(
            "keydown",
            handleKeyboardInput
        );
    }

    function applySettings() {
        const settings =
            Storage.getSettings();

        const mode =
            settings.darkMode || "auto";

        document.documentElement.dataset.theme =
            mode;

        if (
            settings.animation === false
        ) {
            document.documentElement.classList.add(
                "reduce-motion"
            );
        }
    }

    function renderHome(container) {
        const summary =
            Statistics.getSummary(words);

        const todayActivity =
            Storage.getTodayActivity();

        const settings =
            Storage.getSettings();

        const dailyGoal =
            Number(
                settings.questionCount
            ) || 10;

        const dailyProgress =
            Math.min(
                Math.round(
                    todayActivity.answered /
                    dailyGoal *
                    100
                ),
                100
            );

        container.innerHTML = `

            <div
                id="cloudUpdateNotice"
                class="hidden"
            ></div>

            <section class="card home-card">
                <p class="eyebrow">
                    PERSONAL VOCABULARY TRAINER
                </p>

                <h2>
                    今日のクイズ
                </h2>

                <p>
                    苦手な語や、まだ出題されていない語を
                    優先して${dailyGoal}問出題します。
                </p>

                <button
                    id="dailyButton"
                    class="primary"
                    type="button"
                >
                  クイズを始める
                </button>

                <div class="home-quiz-shortcuts">
                <button
                    id="weakQuizButton"
                    class="menuButton"
                    type="button"
                >
                    苦手語クイズ
                </button>

                <button
                    id="unseenQuizButton"
                    class="menuButton"
                    type="button"
                >
                    未出題クイズ
                </button>
            </div>

            </section>


    <section class="card daily-progress-card">
        <div class="daily-progress-heading">
            <div>
                <p class="eyebrow">
                    TODAY
                </p>

                <h3>
                    今日の学習
                </h3>
            </div>

            <strong>
                ${todayActivity.answered}
                / ${dailyGoal}問
            </strong>
        </div>

        <div
            class="daily-progress-track"
            aria-label="今日の学習進捗"
        >
            <div
                class="daily-progress-bar"
                style="width: ${dailyProgress}%"
            ></div>
        </div>

        <p class="daily-progress-message">
            ${
                todayActivity.answered >=
                dailyGoal
                    ? "今日の目標を達成しました。"
                    : `あと${
                        dailyGoal -
                        todayActivity.answered
                    }問で今日の目標達成です。`
            }
        </p>

        ${
            todayActivity.answered
                ? `
                    <p class="daily-progress-accuracy">
                        今日の正答率：
                        <strong>
                            ${Utils.percentage(
                                todayActivity.correct,
                                todayActivity.answered
                            )}%
                        </strong>
                    </p>
                `
                : ""
        }
    </section>

            <section class="card home-menu">
            
                <button
                    id="reviewButton"
                    class="menuButton"
                    type="button"
                >
                    復習ノート
                </button>

                <button
                    id="dictionaryButton"
                    class="menuButton"
                    type="button"
                >
                    語彙一覧
                </button>

                 <button
                    id="addWordsButton"
                    class="menuButton"
                     type="button"
                >
                    語彙を追加
                </button>

                <button
                    id="rankingButton"
                    class="menuButton"
                    type="button"
                >
                    苦手ランキング
                </button>

                <button
                    id="statisticsButton"
                    class="menuButton"
                    type="button"
                >
                    統計
                </button>

                <button
                    id="settingsButton"
                    class="menuButton"
                    type="button"
                >
                    設定
                </button>
            </section>

            <section class="card home-cloud-sync">
                <div class="home-cloud-sync-heading">
                    <div>
                        <p class="eyebrow">
                            CLOUD SYNC
                        </p>

                        <h3>
                            クラウド同期
                        </h3>
                    </div>

                    <span
                        id="homeCloudSyncStatus"
                        class="muted-text"
                    >
                        ${
                            CloudSync.getSecret()
                                ? "同期キー設定済み"
                                : "同期キー未設定"
                        }
                    </span>
                </div>

                ${
                    CloudSync.getSecret()
                        ? `
                            <div class="settings-button-grid">
                                <button
                                    id="homeCloudUploadButton"
                                    class="menuButton"
                                    type="button"
                                >
                                    クラウドへ保存
                                </button>

                                <button
                                    id="homeCloudDownloadButton"
                                    class="menuButton"
                                    type="button"
                                >
                                    クラウドから同期
                                </button>
                            </div>
                        `
                        : `
                            <p class="settings-description">
                                クラウド同期を使うには、
                                設定画面で同期キーを設定してください。
                            </p>

                            <button
                                id="homeCloudSettingsButton"
                                class="menuButton"
                                type="button"
                            >
                                同期設定を開く
                            </button>
                        `
                }
            </section>

        <section class="card stats">
            ${createStatCard(
                "総語彙",
                summary.total,
                "all"
            )}

            ${createStatCard(
                "習得",
                summary.mastered,
                "mastered"
            )}

            ${createStatCard(
                "苦手",
                summary.weak,
                "weak"
            )}

            ${createStatCard(
                "未出題",
                summary.unseen,
                "unseen"
            )}
        </section>
        `;

        container
            .querySelector("#dailyButton")
            .addEventListener(
                "click",
                () => startQuiz()
            );

        container
            .querySelector("#weakQuizButton")
            .addEventListener(
                "click",
                () => {
                    const stats =
                        Storage.getStats();

                    const weakWords =
                        words.filter((word) => {
                            const stat =
                                stats[word.id] ||
                                stats[String(word.id)];

                            if (
                                !stat ||
                                !stat.asked
                            ) {
                                return false;
                            }

                            const accuracy =
                                stat.correct /
                                stat.asked;

                            return (
                                stat.wrong >= 2 ||
                                accuracy < 0.6
                            );
                        });

                    if (!weakWords.length) {
                        alert(
                            "現在、苦手語はありません。"
                        );
                        return;
                    }

                        startQuiz({
                            mode: "weak",
                            words: weakWords,
                            questionCount:
                                Math.min(
                                    dailyGoal,
                                    weakWords.length
                                )
                        });
                }
            );

        container
            .querySelector("#unseenQuizButton")
            .addEventListener(
                "click",
                () => {
                    const stats =
                        Storage.getStats();

                    const unseenWords =
                        words.filter((word) => {
                            const stat =
                                stats[word.id] ||
                                stats[String(word.id)];

                            return (
                                !stat ||
                                !stat.asked
                            );
                        });

                    if (!unseenWords.length) {
                        alert(
                            "未出題の語彙はありません。"
                        );
                        return;
                    }

                    startQuiz({
                        words: unseenWords,
                        questionCount:
                            Math.min(
                                dailyGoal,
                                unseenWords.length
                            )
                    });
                }
            );

        container
            .querySelector("#addWordsButton")
            .addEventListener(
                "click",
                () => Router.show("addWords")
            );

        container
            .querySelector("#reviewButton")
            .addEventListener(
                "click",
                () => Router.show("review")
            );

        container
            .querySelector("#dictionaryButton")
            .addEventListener(
                "click",
                () =>
                    Router.show(
                        "dictionary"
                    )
            );

        container
            .querySelectorAll(
                "[data-stat-filter]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        Router.show(
                            "dictionary",
                            {
                                filter:
                                    button.dataset
                                        .statFilter
                            }
                        );
                    }
                );
            });

        container
            .querySelector("#rankingButton")
            .addEventListener(
                "click",
                () =>
                    Router.show(
                        "review",
                        {
                            rankingOnly: true
                        }
                    )
            );

        container
            .querySelector("#statisticsButton")
            .addEventListener(
                "click",
                () =>
                    Router.show(
                        "statistics"
                    )
            );

        container
            .querySelector("#settingsButton")
            .addEventListener(
                "click",
                () =>
                    Router.show(
                        "settings"
                    )
            );

        const homeCloudSettingsButton =
            container.querySelector(
                "#homeCloudSettingsButton"
            );

        if (homeCloudSettingsButton) {
            homeCloudSettingsButton.addEventListener(
                "click",
                () => Router.show("settings")
            );
        }

        const homeCloudUploadButton =
            container.querySelector(
                "#homeCloudUploadButton"
            );

        if (homeCloudUploadButton) {
            homeCloudUploadButton.addEventListener(
                "click",
                () => uploadCloudBackupFromHome(
                    homeCloudUploadButton
                )
            );
        }

        const homeCloudDownloadButton =
            container.querySelector(
                "#homeCloudDownloadButton"
            );

        if (homeCloudDownloadButton) {
            homeCloudDownloadButton.addEventListener(
                "click",
                () => previewCloudBackupFromHome(
                    container,
                    homeCloudDownloadButton
                )
            );
        }

        checkCloudUpdate(
            container
        );
        }

        async function uploadCloudBackupFromHome(
            button
        ) {
            const confirmed =
                confirm(
                    "この端末の現在のデータをクラウドへ保存します。\nよろしいですか？"
                );

            if (!confirmed) {
                return;
            }

            const originalText =
                button.textContent;

            button.disabled = true;
            button.textContent =
                "保存中...";

            try {
                await CloudSync.uploadBackup();

                alert(
                    "クラウドへ保存しました。"
                );

                Router.show("home");
            } catch (error) {
                console.error(error);

                alert(
                    error.message ||
                    "クラウドへの保存に失敗しました。"
                );

                button.disabled = false;
                button.textContent =
                    originalText;
            }
        }

        async function previewCloudBackupFromHome(
            container,
            button
        ) {
            const originalText =
                button.textContent;

            button.disabled = true;
            button.textContent =
                "確認中...";

            try {
                const cloud =
                    await CloudSync
                        .checkCloudBackup();

                if (
                    !cloud.exists ||
                    !cloud.backup
                ) {
                    alert(
                        "クラウドデータが見つかりませんでした。"
                    );

                    return;
                }

                showCloudMergePreview(
                    container,
                    cloud
                );
            } catch (error) {
                console.error(error);

                alert(
                    error.message ||
                    "クラウドデータの確認に失敗しました。"
                );
            } finally {
                button.disabled = false;
                button.textContent =
                    originalText;
            }
        }

    async function checkCloudUpdate(
        container
    ) {
        /*
        * 同期キーが設定されていなければ
        * 何もしない
        */
        if (!CloudSync.getSecret()) {
            return;
        }

        try {
            const cloud =
                await CloudSync
                    .checkCloudBackup();

            if (
                !cloud.exists ||
                !cloud.cloudSavedAt ||
                !cloud.backup
            ) {
                return;
            }

            const lastSyncedAt =
                CloudSync
                    .getLastSyncedAt();

            const cloudTime =
                Date.parse(
                    cloud.cloudSavedAt
                );

            const localTime =
                lastSyncedAt
                    ? Date.parse(
                        lastSyncedAt
                    )
                    : 0;

            if (
                !Number.isFinite(
                    cloudTime
                ) ||
                cloudTime <= localTime
            ) {
                return;
            }

            /*
            * 非同期処理中に別画面へ
            * 移動していた場合は表示しない
            */
        showCloudMergePreview(
            container,
            cloud
        );

        } catch (error) {
            /*
            * ホームを開いただけで
            * エラー画面にはしない
            */
            console.warn(
                "クラウド更新確認に失敗しました。",
                error
            );
        }
    }

        function showCloudMergePreview(
            container,
            cloud
        ) {
            const notice =
                container.querySelector(
                    "#cloudUpdateNotice"
                );

            if (
                !notice ||
                !cloud?.backup
            ) {
                return;
            }

            const preview =
                Storage.previewBackupMerge(
                    cloud.backup
                );

            const hasChanges =
                preview.vocabulary.added.length > 0 ||
                preview.vocabulary.updated.length > 0 ||
                preview.pendingWords.added.length > 0 ||
                preview.pendingWords.updated.length > 0 ||
                preview.statsChangedCount > 0 ||
                preview.activityChangedCount > 0 ||
                preview.settingsChanged.length > 0;

            notice.classList.remove(
                "hidden"
            );

            notice.innerHTML = `
                <div class="cloud-update-overlay">
                    <section
                        class="card cloud-update-popup"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cloudUpdateTitle"
                    >
                        <p class="eyebrow">
                            CLOUD SYNC
                        </p>

                        <h3 id="cloudUpdateTitle">
                            クラウドデータを同期
                        </h3>

                        <p>
                            同期すると、この端末に以下の変更が反映されます。
                        </p>

                        <div class="cloud-update-summary">
                         ${
                                !hasChanges
                                    ? `
                                        <p>
                                            クラウドとこの端末のデータに
                                            差分はありません。
                                        </p>
                                    `
                                    : ""
                            }
                            ${
                                preview.vocabulary.added.length
                                    ? `
                                        <p>
                                            新しい語彙：
                                            <strong>
                                                ${preview.vocabulary.added.length}語
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                preview.vocabulary.updated.length
                                    ? `
                                        <p>
                                            更新される語彙：
                                            <strong>
                                                ${preview.vocabulary.updated.length}語
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                preview.pendingWords.added.length
                                    ? `
                                        <p>
                                            新しい登録待ち：
                                            <strong>
                                                ${preview.pendingWords.added.length}語
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                preview.pendingWords.updated.length
                                    ? `
                                        <p>
                                            更新される登録待ち：
                                            <strong>
                                                ${preview.pendingWords.updated.length}語
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                preview.statsChangedCount
                                    ? `
                                        <p>
                                            学習履歴：
                                            <strong>
                                                ${preview.statsChangedCount}語
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                preview.activityChangedCount
                                    ? `
                                        <p>
                                            学習日データ：
                                            <strong>
                                                ${preview.activityChangedCount}件
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }

                            ${
                                preview.settingsChanged.length
                                    ? `
                                        <p>
                                            設定：
                                            <strong>
                                                ${preview.settingsChanged.length}件
                                            </strong>
                                        </p>
                                    `
                                    : ""
                            }
                        </div>

                        ${
                            preview.vocabulary.added.length ||
                            preview.vocabulary.updated.length ||
                            preview.pendingWords.added.length ||
                            preview.pendingWords.updated.length
                                ? `
                                    <details class="cloud-update-details">
                                        <summary>
                                            語彙の詳細を見る
                                        </summary>

                                        ${
                                            preview.vocabulary.added.length
                                                ? `
                                                    <div>
                                                        <strong>
                                                            追加される語彙
                                                        </strong>
                                                        <p>
                                                            ${preview.vocabulary.added
                                                                .map(
                                                                    (word) =>
                                                                        Utils.escapeHtml(
                                                                            word
                                                                        )
                                                                )
                                                                .join("、")}
                                                        </p>
                                                    </div>
                                                `
                                                : ""
                                        }

                                        ${
                                            preview.vocabulary.updated.length
                                                ? `
                                                    <div>
                                                        <strong>
                                                            更新される語彙
                                                        </strong>
                                                        <p>
                                                            ${preview.vocabulary.updated
                                                                .map(
                                                                    (word) =>
                                                                        Utils.escapeHtml(
                                                                            word
                                                                        )
                                                                )
                                                                .join("、")}
                                                        </p>
                                                    </div>
                                                `
                                                : ""
                                        }

                                        ${
                                            preview.pendingWords.added.length
                                                ? `
                                                    <div>
                                                        <strong>
                                                            追加される登録待ち
                                                        </strong>
                                                        <p>
                                                            ${preview.pendingWords.added
                                                                .map(
                                                                    (word) =>
                                                                        Utils.escapeHtml(
                                                                            word
                                                                        )
                                                                )
                                                                .join("、")}
                                                        </p>
                                                    </div>
                                                `
                                                : ""
                                        }

                                        ${
                                            preview.pendingWords.updated.length
                                                ? `
                                                    <div>
                                                        <strong>
                                                            更新される登録待ち
                                                        </strong>
                                                        <p>
                                                            ${preview.pendingWords.updated
                                                                .map(
                                                                    (word) =>
                                                                        Utils.escapeHtml(
                                                                            word
                                                                        )
                                                                )
                                                                .join("、")}
                                                        </p>
                                                    </div>
                                                `
                                                : ""
                                        }
                                    </details>
                                `
                                : ""
                        }

            <div class="cloud-update-actions">
                <button
                    id="dismissCloudUpdateButton"
                    class="${hasChanges ? "menuButton" : "primary"}"
                    type="button"
                >
                    ${hasChanges ? "キャンセル" : "閉じる"}
                </button>

                ${
                    hasChanges
                        ? `
                            <button
                                id="syncCloudUpdateButton"
                                class="primary"
                                type="button"
                            >
                                同期する
                            </button>
                        `
                        : ""
                }
            </div>

                    </section>
                </div>
            `;

            bindCloudUpdateNotice(
                notice
            );
        }

    function bindCloudUpdateNotice(
        notice
    ) {
        const dismissButton =
            notice.querySelector(
                "#dismissCloudUpdateButton"
            );

        const syncButton =
            notice.querySelector(
                "#syncCloudUpdateButton"
            );

        dismissButton.addEventListener(
            "click",
            () => {
                notice.classList.add(
                    "hidden"
                );
            }
        );

        if (!syncButton) {
            return;
        }

        syncButton.addEventListener(
            "click",
            async () => {
                syncButton.disabled =
                    true;

                syncButton.textContent =
                    "同期中...";

                try {
                    const result =
                        await CloudSync
                            .downloadBackup();

                    if (!result.exists) {
                        alert(
                            "クラウドデータが見つかりませんでした。"
                        );

                        return;
                    }

                    await reloadWords();

                    alert(
                        "クラウドの最新データを同期しました。"
                    );

                    Router.show(
                        "home"
                    );
                } catch (error) {
                    console.error(
                        error
                    );

                    alert(
                        error.message ||
                        "クラウド同期に失敗しました。"
                    );

                    syncButton.disabled =
                        false;

                    syncButton.textContent =
                        "同期する";
                }
            }
        );
    }

    function createStatCard(
        label,
        value,
        filter
    ) {
        return `
            <button
                class="stat stat-link"
                type="button"
                data-stat-filter="${Utils.escapeAttribute(
                    filter
                )}"
            >
                <span>
                    ${Utils.escapeHtml(label)}
                </span>

                <strong>
                    ${Utils.escapeHtml(
                        String(value)
                    )}
                </strong>
            </button>
        `;
    }

    function startQuiz(options = {}) {
        quizAnswerViewState = null;

        currentQuizMode =
            options.mode || "normal";

        Quiz.start(options);

        Router.show("quiz");
    }

    function startNextQuiz() {
        const settings =
            Storage.getSettings();

        const questionCount =
            Number(
                settings.questionCount
            ) || 10;

        if (currentQuizMode === "unseen") {
            const stats =
                Storage.getStats();

            const unseenWords =
                words.filter((word) => {
                    const stat =
                        stats[word.id] ||
                        stats[String(word.id)];

                    return (
                        !stat ||
                        !stat.asked
                    );
                });

            if (!unseenWords.length) {
                alert(
                    "未出題の語彙をすべて出題しました。"
                );

                Router.show("home");
                return;
            }

            startQuiz({
                mode: "unseen",
                words: unseenWords,
                questionCount:
                    Math.min(
                        questionCount,
                        unseenWords.length
                    )
            });

            return;
        }

        if (currentQuizMode === "weak") {
            const stats =
                Storage.getStats();

            const weakWords =
                words.filter((word) => {
                    const stat =
                        stats[word.id] ||
                        stats[String(word.id)];

                    if (
                        !stat ||
                        !stat.asked
                    ) {
                        return false;
                    }

                    const accuracy =
                        stat.correct /
                        stat.asked;

                    return (
                        stat.wrong >= 2 ||
                        accuracy < 0.6
                    );
                });

            if (!weakWords.length) {
                alert(
                    "現在、苦手語はありません。"
                );

                Router.show("home");
                return;
            }

            startQuiz({
                mode: "weak",
                words: weakWords,
                questionCount:
                    Math.min(
                        questionCount,
                        weakWords.length
                    )
            });

            return;
        }

        startQuiz();
    }

    function renderQuizRoute(container) {
        const question =
            Quiz.getCurrentQuestion();

        if (!question) {
            Router.show(
                "result"
            );
            return;
        }

        container.innerHTML = `
            <section class="quiz-toolbar">
                <button
                    id="quizHomeButton"
                    class="quiz-home-button"
                    type="button"
                >
                    ← ホーム
                </button>

                <span class="quiz-progress-label">
                    問${question.number}
                    / ${question.total}
                </span>
            </section>

            <section class="quiz-progress">
                <progress
                    value="${question.number}"
                    max="${question.total}"
                ></progress>
            </section>

            <section class="card quiz-card">
                <div class="quiz-meta">
                    <span class="badge">
                        ${Utils.escapeHtml(
                            question.typeLabel
                        )}
                    </span>

                    <span class="category">
                        ${Utils.escapeHtml(
                            question.word.category || ""
                        )}
                    </span>
                </div>

                <p class="question-prompt">
                    ${Utils.escapeHtml(
                        question.prompt
                    )}
                </p>

                <h2 class="quiz-word">
                    ${Utils.escapeHtml(
                        question.text
                    )}
                </h2>

                <div
                    id="choices"
                    class="choices"
                >
                    ${question.choices
                        .map(
                            (choice, index) => `
                                <button
                                    class="choice"
                                    type="button"
                                    data-value="${Utils.escapeAttribute(
                                        choice
                                    )}"
                                >
                                    <span class="choice-number">
                                        ${index + 1}
                                    </span>

                                    ${Utils.escapeHtml(
                                        choice
                                    )}
                                </button>
                            `
                        )
                        .join("")}
                </div>

                <section
                    id="answerBox"
                    class="answerBox hidden"
                ></section>
            </section>
        `;

        container
            .querySelector(
                "#quizHomeButton"
            )
            .addEventListener(
                "click",
                () => {
                    const confirmed =
                        confirm(
                            "クイズを中断してホームへ戻りますか？\n現在の途中結果はリザルトに反映されません。"
                        );

                    if (!confirmed) {
                        return;
                    }

                    Router.show("home");
                }
            );

        container
            .querySelectorAll(".choice")
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () =>
                        answerQuestion(
                            button.dataset.value,
                            container
                        )
                );
            });

         if (
            quizAnswerViewState &&
            String(
                quizAnswerViewState.wordId
            ) ===
                String(question.word.id)
        ) {
            renderQuizAnswerState(
                container,
                quizAnswerViewState
            );
        }
    }

      function answerQuestion(
        selectedAnswer,
        container
    ) {
        const result =
            Quiz.answer(
                selectedAnswer
            );

        if (!result) {
            return;
        }

        quizAnswerViewState = {
            wordId:
                result.word.id,

            selectedAnswer,

            correct:
                result.correct,

            correctAnswer:
                result.correctAnswer,

            word:
                result.word,

            meaning:
                result.meaning,

            reading:
                result.reading,

            description:
                result.description,

            choiceWords:
                Quiz.getCurrentQuestion()
                    ?.choiceWords || []
        };

        renderQuizAnswerState(
            container,
            quizAnswerViewState
        );
    }

    function renderQuizAnswerState(
        container,
        state
    ) {
        const buttons =
            container.querySelectorAll(
                ".choice"
            );

        buttons.forEach((button) => {
            button.disabled = true;

            if (
                button.dataset.value ===
                state.correctAnswer
            ) {
                button.classList.add(
                    "correct"
                );
            }

            if (
                !state.correct &&
                button.dataset.value ===
                    state.selectedAnswer
            ) {
                button.classList.add(
                    "wrong"
                );
            }
        });

        const answerBox =
            container.querySelector(
                "#answerBox"
            );

        answerBox.classList.remove(
            "hidden"
        );

    const vocabulary =
        Storage.getVocabulary();

    const storedWord =
        vocabulary.find(
            (word) =>
                String(word.id) ===
                String(state.wordId)
        ) ||
        state.word;

    const questionWords =
        (state.choiceWords || [])
            .map((choiceWord) => {
                return vocabulary.find(
                    (item) =>
                        String(item.id) ===
                        String(choiceWord.id)
                );
            })
            .filter(Boolean);

        answerBox.innerHTML = `
            <h3 class="${
                state.correct
                    ? "correct-text"
                    : "wrong-text"
            }">
                ${
                    state.correct
                        ? "正解"
                        : "不正解"
                }
            </h3>

            <p class="answer-word">
                <strong>
                    ${Utils.escapeHtml(
                        storedWord.word
                    )}
                </strong>

                ${
                    storedWord.reading
                        ? `（${Utils.escapeHtml(
                              storedWord.reading
                          )}）`
                        : ""
                }
            </p>

            <p class="answerMeaning">
                ${Utils.escapeHtml(
                    storedWord.meaning ||
                    state.meaning
                )}
            </p>

            ${
                storedWord.description
                    ? `
                        <p class="answer-description">
                            ${Utils.escapeHtml(
                                storedWord.description
                            )}
                        </p>
                    `
                    : ""
            }

        <button
            id="nextButton"
            class="nextButton"
            type="button"
        >
            次の問題へ
        </button>

        <div class="quiz-question-words">
            <p class="quiz-question-words-label">
                この問題の語彙一覧
            </p>

            ${questionWords
                .map((word) => {
                    const quizTypes =
                        Array.isArray(
                            word.quizTypes
                        )
                            ? word.quizTypes
                            : [];

                    const readingEnabled =
                        quizTypes.includes(
                            "reading"
                        );

                    const canUseReading =
                        Boolean(word.reading) &&
                        /[\u3400-\u9FFF々〆ヵヶ]/u.test(
                            word.word
                        );

                    return `
                        <div class="quiz-question-word-row">
                            <span class="quiz-question-word-name">
                                ${Utils.escapeHtml(
                                    word.word
                                )}
                            </span>

                            <button
                                class="menuButton compact-button quiz-choice-edit-button"
                                type="button"
                                data-word-id="${Utils.escapeAttribute(
                                    String(word.id)
                                )}"
                            >
                                編集
                            </button>

                        <button
                              class="
                                    menuButton
                                    compact-button
                                    quiz-choice-reading-button
                                    ${
                                        canUseReading
                                            ? (
                                                readingEnabled
                                                    ? "reading-on"
                                                    : "reading-off"
                                            )
                                            : "reading-unavailable"
                                    }
                                "
                                type="button"
                                data-word-id="${Utils.escapeAttribute(
                                    String(word.id)
                                )}"
                                ${
                                    canUseReading
                                        ? ""
                                        : "disabled"
                                }
                                aria-pressed="${
                                    canUseReading
                                        ? String(readingEnabled)
                                        : "false"
                                }"
                            >
                                ${
                                    canUseReading
                                        ? (
                                            readingEnabled
                                                ? "読 ✓"
                                                : "読 ×"
                                        )
                                        : "―"
                                }
                            </button>
                        </div>
                    `;
                })
                .join("")}
        </div>

        `;

answerBox
    .querySelectorAll(
        ".quiz-choice-edit-button"
    )
    .forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                Router.show(
                    "editWord",
                    {
                        wordId:
                            button.dataset.wordId,

                        returnTo:
                            "quiz"
                    }
                );
            }
        );
    });

    answerBox
        .querySelectorAll(
            ".quiz-choice-reading-button"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    const wordId =
                        button.dataset.wordId;

                    const currentWord =
                        Storage.getVocabulary()
                            .find(
                                (word) =>
                                    String(word.id) ===
                                    String(wordId)
                            );

                    if (!currentWord) {
                        return;
                    }

                    const currentTypes =
                        Array.isArray(
                            currentWord.quizTypes
                        )
                            ? [
                                ...currentWord.quizTypes
                            ]
                            : [];

                    const hasReading =
                        currentTypes.includes(
                            "reading"
                        );

                    const nextTypes =
                        hasReading
                            ? currentTypes.filter(
                                (type) =>
                                    type !==
                                    "reading"
                            )
                            : [
                                ...currentTypes,
                                "reading"
                            ];

                    Storage.updateVocabularyWord(
                        wordId,
                        {
                            quizTypes:
                                nextTypes
                        }
                    );

                    renderQuizAnswerState(
                        container,
                        state
                    );
                }
            );
        });

        answerBox
            .querySelector(
                "#nextButton"
            )
            .addEventListener(
                "click",
                moveToNextQuestion
            );
    }

    function moveToNextQuestion() {
        quizAnswerViewState = null;

        const nextQuestion =
            Quiz.next();

        if (!nextQuestion) {
            Router.show(
                "result"
            );
            return;
        }

        Router.show(
            "quiz"
        );
    }

    function renderResultRoute(container) {
        const result =
            Quiz.getResult();

            const todayActivity =
            Storage.getTodayActivity();

        const minutes = String(
            Math.floor(
                result.elapsedSeconds / 60
            )
        ).padStart(2, "0");

        const seconds = String(
            result.elapsedSeconds % 60
        ).padStart(2, "0");

        container.innerHTML = `
            <section class="card result-card">
                <p class="eyebrow">
                    RESULT
                </p>

                <h2>
                    今回の結果
                </h2>

                <div class="result-score">
                    <strong>
                        ${result.score}
                    </strong>

                    <span>
                        / ${result.total}
                    </span>
                </div>

                <p>
                    正答率
                    <strong>
                        ${result.accuracy}%
                    </strong>
                </p>

                <p>
                    所要時間
                    <strong>
                        ${minutes}:${seconds}
                    </strong>
                </p>

        <section class="today-result-summary">
            <span>
                今日の累計
            </span>

            <strong>
                ${todayActivity.answered}問
            </strong>

            <span>
                正答率
                ${Utils.percentage(
                    todayActivity.correct,
                    todayActivity.answered
                )}%
            </span>
        </section>

                <div class="result-actions">
                    <button
                        id="homeButton"
                        class="menuButton"
                        type="button"
                    >
                        ホームへ戻る
                    </button>

                    ${
                        result.wrongAnswers.length
                            ? `
                                <button
                                    id="retryWrongButton"
                                    class="menuButton"
                                    type="button"
                                >
                                    間違えた問題を復習
                                </button>
                            `
                            : ""
                    }

                    <button
                        id="newQuizButton"
                        class="primary"
                        type="button"
                    >
                        新しいクイズ
                    </button>
                </div>
            </section>

            ${
                result.wrongAnswers.length
                    ? createWrongAnswersSection(
                          result.wrongAnswers
                      )
                    : ""
            }
        `;

        container
            .querySelector("#homeButton")
            .addEventListener(
                "click",
                () =>
                    Router.show(
                        "home"
                    )
            );

        container
            .querySelector("#newQuizButton")
            .addEventListener(
                "click",
                () =>
                    startNextQuiz()
            );

        const retryButton =
            container.querySelector(
                "#retryWrongButton"
            );

        if (retryButton) {
            retryButton.addEventListener(
                "click",
                () => {
                    const wrongIds =
                        new Set(
                            result.wrongAnswers.map(
                                (answer) =>
                                    String(
                                        answer.wordId
                                    )
                            )
                        );

                    const retryWords =
                        words.filter(
                            (word) =>
                                wrongIds.has(
                                    String(
                                        word.id
                                    )
                                )
                        );

                    startQuiz({
                        words: retryWords,
                        questionCount:
                            retryWords.length
                    });
                }
            );
        }
    }

    function createWrongAnswersSection(
        wrongAnswers
    ) {
        return `
            <section class="card wrong-list">
                <h3>
                    間違えた語
                </h3>

                ${wrongAnswers
                    .map(
                        (answer) => `
                            <article class="wrong-item">
                                <strong>
                                    ${Utils.escapeHtml(
                                        answer.word
                                    )}
                                </strong>

                                <span>
                                    ${Utils.escapeHtml(
                                        answer.reading || ""
                                    )}
                                </span>

                                <p>
                                    ${Utils.escapeHtml(
                                        answer.meaning
                                    )}
                                </p>
                            </article>
                        `
                    )
                    .join("")}
            </section>
        `;
    }

    function handleKeyboardInput(event) {
        const route =
            Router.getCurrentRoute();

        if (
            !route ||
            route.name !== "quiz"
        ) {
            return;
        }

        const numericKey =
            Number(event.key);

        if (
            numericKey >= 1 &&
            numericKey <= 4
        ) {
            const buttons =
                document.querySelectorAll(
                    ".choice:not(:disabled)"
                );

            const button =
                buttons[numericKey - 1];

            if (button) {
                button.click();
            }
        }

        if (
            event.key === "Enter"
        ) {
            const nextButton =
                document.getElementById(
                    "nextButton"
                );

            if (nextButton) {
                nextButton.click();
            }
        }
    }

    function renderFatalError(error) {
        const view =
            document.getElementById(
                "view"
            );

        if (!view) {
            return;
        }

        view.innerHTML = `
            <section class="card error-card">
                <h2>
                    読み込みエラー
                </h2>

                <p>
                    ${Utils.escapeHtml(
                        error.message ||
                            "不明なエラーです。"
                    )}
                </p>

                <button
                    class="primary"
                    type="button"
                    onclick="location.reload()"
                >
                    再読み込み
                </button>
            </section>
        `;
    }

    return {
        init,
        startQuiz,
        reloadWords,
        resumeQuizAfterEdit,

        getWords() {
            return [...words];
        },
    };
})();

document.addEventListener(
    "DOMContentLoaded",
    App.init
);