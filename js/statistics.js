"use strict";

const Statistics = (() => {
    function getSummary(words) {
        const stats = Storage.getStats();

        const summary = {
            total: words.length,
            unseen: 0,
            weak: 0,
            learning: 0,
            mastered: 0,
            asked: 0,
            correct: 0,
            wrong: 0,
            accuracy: 0
        };

        for (const word of words) {
            const stat =
                stats[word.id] ||
                stats[String(word.id)];

            if (!stat || !stat.asked) {
                summary.unseen++;
                continue;
            }

            const asked =
                Number(stat.asked) || 0;

            const correct =
                Number(stat.correct) || 0;

            const wrong =
                Number(stat.wrong) || 0;

            summary.asked += asked;
            summary.correct += correct;
            summary.wrong += wrong;

            const level =
                getLearningLevel(stat);

            if (level === "mastered") {
                summary.mastered++;
            } else if (
                level === "weak" ||
                level === "veryWeak"
            ) {
                summary.weak++;
            } else {
                summary.learning++;
            }
        }

        summary.accuracy =
            Utils.percentage(
                summary.correct,
                summary.asked
            );

        return summary;
    }

    function getLearningLevel(stat) {
        if (!stat || !stat.asked) {
            return "unseen";
        }

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

        if (
            asked >= 5 &&
            accuracy >= 0.9 &&
            streak >= 3
        ) {
            return "mastered";
        }

        if (
            wrong >= 3 &&
            accuracy < 0.4
        ) {
            return "veryWeak";
        }

        if (
            wrong >= 2 ||
            accuracy < 0.6
        ) {
            return "weak";
        }

        if (accuracy >= 0.75) {
            return "strong";
        }

        return "learning";
    }

    function getLevelLabel(level) {
        const labels = {
            unseen: "未出題",
            veryWeak: "かなり苦手",
            weak: "苦手",
            learning: "学習中",
            strong: "得意",
            mastered: "習得"
        };

        return labels[level] || "学習中";
    }

    function getLevelRank(level) {
        const ranks = {
            veryWeak: 1,
            weak: 2,
            learning: 3,
            strong: 4,
            mastered: 5,
            unseen: 0
        };

        return ranks[level] ?? 0;
    }

    function render(container, words) {
        const summary =
            getSummary(words);

        const stats =
            Storage.getStats();

        const studiedWords =
            words.filter((word) => {
                const stat =
                    stats[word.id] ||
                    stats[String(word.id)];

                return Boolean(
                    stat && stat.asked
                );
            });

        const mostStudied =
            [...studiedWords]
                .sort((a, b) => {
                    const statA =
                        stats[a.id] ||
                        stats[String(a.id)];

                    const statB =
                        stats[b.id] ||
                        stats[String(b.id)];

                    return (
                        Number(statB.asked || 0) -
                        Number(statA.asked || 0)
                    );
                })
                .slice(0, 5);

        const strongest =
            [...studiedWords]
                .filter((word) => {
                    const stat =
                        stats[word.id] ||
                        stats[String(word.id)];

                    return (
                        Number(stat.asked || 0) >= 2
                    );
                })
                .sort((a, b) => {
                    const statA =
                        stats[a.id] ||
                        stats[String(a.id)];

                    const statB =
                        stats[b.id] ||
                        stats[String(b.id)];

                    const accuracyA =
                        statA.correct /
                        statA.asked;

                    const accuracyB =
                        statB.correct /
                        statB.asked;

                    if (
                        accuracyA !==
                        accuracyB
                    ) {
                        return (
                            accuracyB -
                            accuracyA
                        );
                    }

                    return (
                        statB.asked -
                        statA.asked
                    );
                })
                .slice(0, 5);

        container.innerHTML = `
            <section class="card statistics-header">
                <div class="page-heading">
                    <div>
                        <p class="eyebrow">
                            STATISTICS
                        </p>

                        <h2>
                            学習統計
                        </h2>

                        <p class="page-description">
                            これまでの学習状況を確認できます。
                        </p>
                    </div>

                    <button
                        id="statisticsHomeButton"
                        class="menuButton compact-button"
                        type="button"
                    >
                        ホームへ戻る
                    </button>
                </div>
            </section>

            <section class="statistics-grid">
                ${createSummaryCard(
                    "総語彙",
                    summary.total
                )}

                ${createSummaryCard(
                    "出題済み",
                    summary.total -
                        summary.unseen
                )}

                ${createSummaryCard(
                    "未出題",
                    summary.unseen
                )}

                ${createSummaryCard(
                    "習得",
                    summary.mastered
                )}

                ${createSummaryCard(
                    "苦手",
                    summary.weak
                )}

                ${createSummaryCard(
                    "累計正答率",
                    summary.asked
                        ? `${summary.accuracy}%`
                        : "--"
                )}
            </section>

            <section class="card progress-section">
                <h3>
                    語彙の習得状況
                </h3>

                ${createProgressRow(
                    "習得",
                    summary.mastered,
                    summary.total,
                    "mastered"
                )}

                ${createProgressRow(
                    "学習中・得意",
                    summary.learning,
                    summary.total,
                    "learning"
                )}

                ${createProgressRow(
                    "苦手",
                    summary.weak,
                    summary.total,
                    "weak"
                )}

                ${createProgressRow(
                    "未出題",
                    summary.unseen,
                    summary.total,
                    "unseen"
                )}
            </section>

            <section class="card">
                <h3>
                    累計回答
                </h3>

                <div class="answer-stat-grid">
                    ${createSummaryCard(
                        "回答数",
                        summary.asked
                    )}

                    ${createSummaryCard(
                        "正解",
                        summary.correct
                    )}

                    ${createSummaryCard(
                        "不正解",
                        summary.wrong
                    )}
                </div>
            </section>

            ${createWordRankingSection(
                "よく出題された語",
                mostStudied,
                stats,
                "asked"
            )}

            ${createWordRankingSection(
                "正答率が高い語",
                strongest,
                stats,
                "accuracy"
            )}
        `;

        container
            .querySelector(
                "#statisticsHomeButton"
            )
            .addEventListener(
                "click",
                () => Router.show("home")
            );

        container
            .querySelectorAll(
                "[data-stat-word-id]"
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
                                        .statWordId
                            }
                        );
                    }
                );
            });
    }

    function createSummaryCard(
        label,
        value
    ) {
        return `
            <article class="stat-card-large">
                <span>
                    ${Utils.escapeHtml(label)}
                </span>

                <strong>
                    ${Utils.escapeHtml(
                        String(value)
                    )}
                </strong>
            </article>
        `;
    }

    function createProgressRow(
        label,
        value,
        total,
        type
    ) {
        const percentage =
            total > 0
                ? Math.round(
                    value / total * 100
                )
                : 0;

        return `
            <div class="progress-row">
                <div class="progress-label">
                    <span>
                        ${Utils.escapeHtml(label)}
                    </span>

                    <strong>
                        ${value}語
                    </strong>
                </div>

                <div class="learning-progress-track">
                    <div
                        class="learning-progress-bar ${Utils.escapeAttribute(type)}"
                        style="width: ${percentage}%"
                    ></div>
                </div>
            </div>
        `;
    }

    function createWordRankingSection(
        title,
        words,
        stats,
        mode
    ) {
        if (!words.length) {
            return "";
        }

        return `
            <section class="card statistics-word-list">
                <h3>
                    ${Utils.escapeHtml(title)}
                </h3>

                ${words
                    .map((word, index) => {
                        const stat =
                            stats[word.id] ||
                            stats[String(word.id)];

                        const value =
                            mode === "asked"
                                ? `${stat.asked}回`
                                : `${Utils.percentage(
                                    stat.correct,
                                    stat.asked
                                )}%`;

                        return `
                            <button
                                class="statistics-word-item"
                                type="button"
                                data-stat-word-id="${Utils.escapeAttribute(
                                    word.id
                                )}"
                            >
                                <span class="statistics-rank">
                                    ${index + 1}
                                </span>

                                <span class="statistics-word-name">
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

                                <span class="statistics-word-value">
                                    ${Utils.escapeHtml(value)}
                                </span>
                            </button>
                        `;
                    })
                    .join("")}
            </section>
        `;
    }

    return {
        render,
        getSummary,
        getLearningLevel,
        getLevelLabel,
        getLevelRank
    };
})();