"use strict";

const Review = (() => {
    let allWords = [];
    let rankingOnly = false;
    let selectedLevel = "all";

    function render(
        container,
        words,
        params = {}
    ) {
        allWords =
            Array.isArray(words)
                ? [...words]
                : [];

        rankingOnly =
            Boolean(params.rankingOnly);

        renderReviewPage(container);
    }

    function renderReviewPage(container) {
        const reviewWords =
            getReviewWords();

        const title =
            rankingOnly
                ? "苦手ランキング"
                : "復習ノート";

        const description =
            rankingOnly
                ? "正答率が低い語、誤答回数が多い語を優先して表示します。"
                : "一度でも間違えた語を、苦手度の高い順に確認できます。";

        container.innerHTML = `
            <section class="card review-header-card">
                <div class="page-heading">
                    <div>
                        <p class="eyebrow">
                            ${
                                rankingOnly
                                    ? "WEAK WORDS"
                                    : "REVIEW NOTE"
                            }
                        </p>

                        <h2>
                            ${title}
                        </h2>

                        <p class="page-description">
                            ${description}
                        </p>
                    </div>

                    <button
                        id="reviewHomeButton"
                        class="menuButton compact-button"
                        type="button"
                    >
                        ホームへ戻る
                    </button>
                </div>

                ${
                    !rankingOnly
                        ? createLevelFilters()
                        : ""
                }

                <div class="review-action-row">
                    <p class="review-count">
                        ${reviewWords.length}語
                    </p>

                    ${
                        reviewWords.length
                            ? `
                                <button
                                    id="startReviewQuizButton"
                                    class="primary compact-primary"
                                    type="button"
                                >
                                    この一覧から復習
                                </button>
                            `
                            : ""
                    }
                </div>
            </section>

            <section
                id="reviewWordList"
                class="review-word-list"
            >
                ${createReviewItems(
                    reviewWords
                )}
            </section>
        `;

        bindEvents(
            container,
            reviewWords
        );
    }

    function getReviewWords() {
        const stats =
            Storage.getStats();

        const reviewWords =
            allWords
                .map((word) => {
                    const stat =
                        stats[word.id] ||
                        stats[String(word.id)];

                    if (
                        !stat ||
                        !stat.asked ||
                        !stat.wrong
                    ) {
                        return null;
                    }

                    const level =
                        Statistics.getLearningLevel(
                            stat
                        );

                    const accuracy =
                        Utils.percentage(
                            stat.correct,
                            stat.asked
                        );

                    const weaknessScore =
                        calculateWeaknessScore(
                            stat
                        );

                    return {
                        word,
                        stat,
                        level,
                        accuracy,
                        weaknessScore
                    };
                })
                .filter(Boolean);

        let filtered =
            reviewWords;

        if (
            !rankingOnly &&
            selectedLevel !== "all"
        ) {
            filtered =
                reviewWords.filter(
                    (item) =>
                        item.level ===
                        selectedLevel
                );
        }

        return filtered.sort(
            (a, b) => {
                if (
                    b.weaknessScore !==
                    a.weaknessScore
                ) {
                    return (
                        b.weaknessScore -
                        a.weaknessScore
                    );
                }

                return (
                    a.word.reading ||
                    a.word.word
                ).localeCompare(
                    b.word.reading ||
                    b.word.word,
                    "ja"
                );
            }
        );
    }

    function calculateWeaknessScore(stat) {
        const asked =
            Number(stat.asked) || 0;

        const correct =
            Number(stat.correct) || 0;

        const wrong =
            Number(stat.wrong) || 0;

        const streak =
            Number(stat.streak) || 0;

        const accuracy =
            asked > 0
                ? correct / asked
                : 0;

        return (
            wrong * 4 +
            (1 - accuracy) * 10 -
            streak * 0.5
        );
    }

    function createLevelFilters() {
        const filters = [
            ["all", "すべて"],
            ["veryWeak", "かなり苦手"],
            ["weak", "苦手"],
            ["learning", "学習中"],
            ["strong", "得意"],
            ["mastered", "習得"]
        ];

        return `
            <div class="filter-tabs review-filter-tabs">
                ${filters
                    .map(
                        ([value, label]) => `
                            <button
                                class="filter-tab ${
                                    selectedLevel ===
                                    value
                                        ? "active"
                                        : ""
                                }"
                                type="button"
                                data-review-level="${value}"
                            >
                                ${Utils.escapeHtml(label)}
                            </button>
                        `
                    )
                    .join("")}
            </div>
        `;
    }

    function createReviewItems(items) {
        if (!items.length) {
            return `
                <section class="card empty-state">
                    <h3>
                        ${
                            rankingOnly
                                ? "苦手語はまだありません"
                                : "復習対象の語はありません"
                        }
                    </h3>

                    <p>
                        クイズで間違えた語が、
                        ここに表示されます。
                    </p>
                </section>
            `;
        }

        return items
            .map(
                (item, index) =>
                    createReviewItem(
                        item,
                        index
                    )
            )
            .join("");
    }

    function createReviewItem(
        item,
        index
    ) {
        const {
            word,
            stat,
            level,
            accuracy
        } = item;

        const levelLabel =
            Statistics.getLevelLabel(
                level
            );

        const stars =
            createMasteryStars(level);

        return `
            <article class="card review-word-card">
                <button
                    class="review-word-main-button"
                    type="button"
                    data-review-word-id="${Utils.escapeAttribute(
                        word.id
                    )}"
                >
                    ${
                        rankingOnly
                            ? `
                                <span class="review-rank">
                                    ${index + 1}
                                </span>
                            `
                            : ""
                    }

                    <span class="review-word-content">
                        <span class="review-word-heading">
                            <strong>
                                ${Utils.escapeHtml(
                                    word.word
                                )}
                            </strong>

                            <small>
                                ${Utils.escapeHtml(
                                    word.reading || ""
                                )}
                            </small>
                        </span>

                        <span class="review-mastery">
                            <span
                                class="mastery-label level-${Utils.escapeAttribute(level)}"
                            >
                                ${Utils.escapeHtml(
                                    levelLabel
                                )}
                            </span>

                            <span
                                class="mastery-stars"
                                aria-label="習熟度"
                            >
                                ${stars}
                            </span>
                        </span>
                    </span>

                    <span class="review-score">
                        <strong>
                            ${accuracy}%
                        </strong>

                        <small>
                            ${stat.correct}正解 /
                            ${stat.wrong}不正解
                        </small>
                    </span>
                </button>

                <p class="review-word-meaning">
                    ${Utils.escapeHtml(
                        word.meaning
                    )}
                </p>
            </article>
        `;
    }

    function createMasteryStars(level) {
        const filled =
            Statistics.getLevelRank(
                level
            );

        return `${"★".repeat(filled)}${"☆".repeat(
            Math.max(0, 5 - filled)
        )}`;
    }

    function bindEvents(
        container,
        reviewWords
    ) {
        container
            .querySelector(
                "#reviewHomeButton"
            )
            .addEventListener(
                "click",
                () => Router.show("home")
            );

        container
            .querySelectorAll(
                "[data-review-level]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        selectedLevel =
                            button.dataset
                                .reviewLevel;

                        renderReviewPage(
                            container
                        );
                    }
                );
            });

        container
            .querySelectorAll(
                "[data-review-word-id]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        Router.show(
                            "dictionary",
                            {
                                wordId:
                                    button.dataset
                                        .reviewWordId
                            }
                        );
                    }
                );
            });

        const quizButton =
            container.querySelector(
                "#startReviewQuizButton"
            );

        if (quizButton) {
            quizButton.addEventListener(
                "click",
                () => {
                    const selectedWords =
                        reviewWords
                            .slice(0, 30)
                            .map(
                                (item) =>
                                    item.word
                            );

                    const settings =
                        Storage.getSettings();

                    App.startQuiz({
                        words:
                            selectedWords,
                        questionCount:
                            Math.min(
                                Number(
                                    settings.questionCount
                                ) || 10,
                                selectedWords.length
                            )
                    });
                }
            );
        }
    }

    return {
        render
    };
})();