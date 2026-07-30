"use strict";

const App = (() => {
    let words = [];

    async function init() {
        try {
            words = await loadWords();

            updateHeaderWordCount();

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
        const response = await fetch(
            "data/words.json",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `語彙データの読み込みに失敗しました。` +
                ` HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const wordList = Array.isArray(data)
            ? data
            : data.words;

        if (!Array.isArray(wordList)) {
            throw new Error(
                "words.json の形式が不正です。"
            );
        }

        return wordList;
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

    function registerRoutes() {
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

    const dailyWords =
        getRecommendedWords(dailyGoal);

        container.innerHTML = `
            <section class="card home-card">
                <p class="eyebrow">
                    PERSONAL VOCABULARY TRAINER
                </p>

                <h2>
                    今日のおすすめ復習
                </h2>

                <p>
                    苦手な語や、まだ出題されていない語を
                    優先して5問出題します。
                </p>

                <button
                    id="dailyButton"
                    class="primary"
                    type="button"
                >
                 今日の${dailyGoal}問
                </button>
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
                    id="startQuiz"
                    class="menuButton"
                    type="button"
                >
                    クイズ開始
                </button>

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

            <section class="card stats">
                ${createStatCard(
                    "総語彙",
                    summary.total
                )}

                ${createStatCard(
                    "習得",
                    summary.mastered
                )}

                ${createStatCard(
                    "苦手",
                    summary.weak
                )}

                ${createStatCard(
                    "未出題",
                    summary.unseen
                )}
            </section>
        `;

        container
            .querySelector("#dailyButton")
            .addEventListener(
                "click",
                () => {
                    startQuiz({
                        questionCount:
                            dailyWords.length,
                        words:
                            dailyWords
                    });
                }
            );

        container
            .querySelector("#startQuiz")
            .addEventListener(
                "click",
                () => startQuiz()
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
    }

    function createStatCard(
        label,
        value
    ) {
        return `
            <article class="stat">
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

    function getRecommendedWords(count) {
        return [...words]
            .map((word) => ({
                word,
                weight:
                    Quiz.calculateWeight(
                        word
                    )
            }))
            .sort(
                (a, b) =>
                    b.weight - a.weight
            )
            .slice(0, count)
            .map(
                (item) => item.word
            );
    }

    function startQuiz(options = {}) {
        Quiz.start(options);

        Router.show("quiz");
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
            <section class="quiz-progress">
                <span>
                    問${question.number}
                    / ${question.total}
                </span>

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

        const buttons =
            container.querySelectorAll(
                ".choice"
            );

        buttons.forEach((button) => {
            button.disabled = true;

            if (
                button.dataset.value ===
                result.correctAnswer
            ) {
                button.classList.add(
                    "correct"
                );
            }

            if (
                !result.correct &&
                button.dataset.value ===
                    selectedAnswer
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

        answerBox.innerHTML = `
            <h3 class="${
                result.correct
                    ? "correct-text"
                    : "wrong-text"
            }">
                ${
                    result.correct
                        ? "正解"
                        : "不正解"
                }
            </h3>

            <p class="answer-word">
                <strong>
                    ${Utils.escapeHtml(
                        result.word.word
                    )}
                </strong>

                ${
                    result.word.reading
                        ? `（${Utils.escapeHtml(
                              result.word.reading
                          )}）`
                        : ""
                }
            </p>

            <p class="answerMeaning">
                ${Utils.escapeHtml(
                    result.meaning
                )}
            </p>

            ${
                result.description
                    ? `
                        <p class="answer-description">
                            ${Utils.escapeHtml(
                                result.description
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
        `;

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
                    startQuiz()
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
        getWords() {
            return [...words];
        }
    };
})();

document.addEventListener(
    "DOMContentLoaded",
    App.init
);