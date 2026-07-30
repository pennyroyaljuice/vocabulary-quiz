"use strict";

const Dictionary = (() => {
    let allWords = [];
    let currentQuery = "";
    let currentFilter = "all";

    const GROUPS = [
        { key: "あ", pattern: /^[あいうえおぁぃぅぇぉアイウエオァィゥェォ]/u },
        { key: "か", pattern: /^[かきくけこがぎぐげごカキクケコガギグゲゴ]/u },
        { key: "さ", pattern: /^[さしすせそざじずぜぞサシスセソザジズゼゾ]/u },
        { key: "た", pattern: /^[たちつてとだぢづでどタチツテトダヂヅデド]/u },
        { key: "な", pattern: /^[なにぬねのナニヌネノ]/u },
        { key: "は", pattern: /^[はひふへほばびぶべぼぱぴぷぺぽハヒフヘホバビブベボパピプペポ]/u },
        { key: "ま", pattern: /^[まみむめもマミムメモ]/u },
        { key: "や", pattern: /^[やゆよゃゅょヤユヨャュョ]/u },
        { key: "ら", pattern: /^[らりるれろラリルレロ]/u },
        { key: "わ", pattern: /^[わをんワヲン]/u },
        { key: "英", pattern: /^[A-Za-z]/u },
        { key: "他", pattern: /./u }
    ];

    function render(container, words, params = {}) {
        allWords = Array.isArray(words) ? [...words] : [];

        if (params.wordId !== undefined) {
            renderDetail(
                container,
                params.wordId
            );
            return;
        }

        renderList(container);
    }

    function renderList(container) {
        const filteredWords = getFilteredWords();

        container.innerHTML = `
            <section class="card dictionary-header">
                <div class="page-heading">
                    <div>
                        <p class="eyebrow">
                            DICTIONARY
                        </p>

                        <h2>
                            語彙一覧
                        </h2>

                        <p class="page-description">
                            登録されている語彙を検索・確認できます。
                        </p>
                    </div>

                    <button
                        id="dictionaryHomeButton"
                        class="menuButton compact-button"
                        type="button"
                    >
                        ホームへ戻る
                    </button>
                </div>

                <label
                    class="search-label"
                    for="dictionarySearch"
                >
                    語彙を検索
                </label>

                <input
                    id="dictionarySearch"
                    class="search-input"
                    type="search"
                    placeholder="語彙・読み・意味・カテゴリ"
                    autocomplete="off"
                    value="${Utils.escapeAttribute(currentQuery)}"
                >

                <div class="filter-tabs">
                    ${createFilterButton(
                        "all",
                        "すべて"
                    )}

                    ${createFilterButton(
                        "favorite",
                        "お気に入り"
                    )}

                    ${createFilterButton(
                        "weak",
                        "苦手"
                    )}

                    ${createFilterButton(
                        "unseen",
                        "未出題"
                    )}
                </div>

                <p class="dictionary-count">
                    ${filteredWords.length}語
                </p>
            </section>

            <nav
                id="kanaIndex"
                class="kana-index card"
                aria-label="五十音インデックス"
            >
                ${createKanaIndex(filteredWords)}
            </nav>

            <section
                id="dictionaryList"
                class="dictionary-list"
            >
                ${createDictionaryGroups(filteredWords)}
            </section>
        `;

        bindListEvents(container);
    }

    function createFilterButton(
        value,
        label
    ) {
        const active =
            currentFilter === value
                ? "active"
                : "";

        return `
            <button
                class="filter-tab ${active}"
                type="button"
                data-filter="${value}"
            >
                ${Utils.escapeHtml(label)}
            </button>
        `;
    }

    function bindListEvents(container) {
        const homeButton =
            container.querySelector(
                "#dictionaryHomeButton"
            );

        homeButton.addEventListener(
            "click",
            () => Router.show("home")
        );

        const searchInput =
            container.querySelector(
                "#dictionarySearch"
            );

        searchInput.addEventListener(
            "input",
            (event) => {
                currentQuery =
                    event.target.value;

                updateListArea(
                    container
                );
            }
        );

        container
            .querySelectorAll(
                ".filter-tab"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        currentFilter =
                            button.dataset.filter;

                        renderList(
                            container
                        );
                    }
                );
            });

        bindWordButtons(container);
        bindKanaButtons(container);
    }

    function updateListArea(container) {
        const filteredWords =
            getFilteredWords();

        const count =
            container.querySelector(
                ".dictionary-count"
            );

        const index =
            container.querySelector(
                "#kanaIndex"
            );

        const list =
            container.querySelector(
                "#dictionaryList"
            );

        count.textContent =
            `${filteredWords.length}語`;

        index.innerHTML =
            createKanaIndex(
                filteredWords
            );

        list.innerHTML =
            createDictionaryGroups(
                filteredWords
            );

        bindWordButtons(container);
        bindKanaButtons(container);
    }

    function bindWordButtons(container) {
        container
            .querySelectorAll(
                "[data-word-id]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        Router.show(
                            "dictionary",
                            {
                                wordId:
                                    button.dataset.wordId
                            }
                        );
                    }
                );
            });
    }

    function bindKanaButtons(container) {
        container
            .querySelectorAll(
                "[data-group-target]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        const target =
                            document.getElementById(
                                button.dataset.groupTarget
                            );

                        if (target) {
                            target.scrollIntoView({
                                behavior: "smooth",
                                block: "start"
                            });
                        }
                    }
                );
            });
    }

    function getFilteredWords() {
        const stats =
            Storage.getStats();

        const normalizedQuery =
            currentQuery
                .normalize("NFKC")
                .toLowerCase()
                .trim();

        return allWords
            .filter((word) => {
                if (!matchesQuery(
                    word,
                    normalizedQuery
                )) {
                    return false;
                }

                const stat =
                    stats[word.id] ||
                    stats[String(word.id)] ||
                    null;

                switch (currentFilter) {
                    case "favorite":
                        return Boolean(
                            stat?.favorite
                        );

                    case "weak":
                        return isWeakWord(
                            stat
                        );

                    case "unseen":
                        return !stat ||
                            !stat.asked;

                    case "all":
                    default:
                        return true;
                }
            })
            .sort(compareWords);
    }

    function matchesQuery(
        word,
        query
    ) {
        if (!query) {
            return true;
        }

        const values = [
            word.word,
            word.reading,
            word.meaning,
            word.description,
            word.category
        ];

        return values.some(
            (value) =>
                String(value || "")
                    .normalize("NFKC")
                    .toLowerCase()
                    .includes(query)
        );
    }

    function compareWords(a, b) {
        const readingA =
            a.reading || a.word;

        const readingB =
            b.reading || b.word;

        return readingA.localeCompare(
            readingB,
            "ja"
        );
    }

    function isWeakWord(stat) {
        if (!stat || !stat.asked) {
            return false;
        }

        const accuracy =
            stat.correct /
            stat.asked;

        return stat.wrong >= 2 ||
            accuracy < 0.6;
    }

    function createKanaIndex(words) {
        const groups =
            groupWords(words);

        if (groups.size === 0) {
            return `
                <span class="muted-text">
                    該当する語彙はありません。
                </span>
            `;
        }

        return [...groups.keys()]
            .map((key) => `
                <button
                    type="button"
                    class="kana-button"
                    data-group-target="dictionary-group-${Utils.escapeAttribute(key)}"
                >
                    ${Utils.escapeHtml(key)}
                </button>
            `)
            .join("");
    }

    function createDictionaryGroups(words) {
        const groups =
            groupWords(words);

        if (groups.size === 0) {
            return `
                <section class="card empty-state">
                    <h3>
                        該当する語彙がありません
                    </h3>

                    <p>
                        検索条件や絞り込みを変更してください。
                    </p>
                </section>
            `;
        }

        return [...groups.entries()]
            .map(
                ([groupName, groupWords]) => `
                    <section
                        id="dictionary-group-${Utils.escapeAttribute(groupName)}"
                        class="dictionary-group card"
                    >
                        <h3 class="dictionary-group-title">
                            ${Utils.escapeHtml(groupName)}
                        </h3>

                        <div class="dictionary-items">
                            ${groupWords
                                .map(
                                    createWordListItem
                                )
                                .join("")}
                        </div>
                    </section>
                `
            )
            .join("");
    }

    function createWordListItem(word) {
        const stats =
            Storage.getStats();

        const stat =
            stats[word.id] ||
            stats[String(word.id)] ||
            null;

        const accuracy =
            stat?.asked
                ? Utils.percentage(
                    stat.correct,
                    stat.asked
                )
                : null;

        const favoriteMark =
            stat?.favorite
                ? "★"
                : "";

        return `
            <button
                type="button"
                class="dictionary-item"
                data-word-id="${Utils.escapeAttribute(word.id)}"
            >
                <span class="dictionary-word-main">
                    <strong>
                        ${Utils.escapeHtml(word.word)}
                    </strong>

                    ${
                        word.reading
                            ? `
                                <small>
                                    ${Utils.escapeHtml(word.reading)}
                                </small>
                            `
                            : ""
                    }
                </span>

                <span class="dictionary-word-meta">
                    ${
                        favoriteMark
                            ? `
                                <span
                                    class="favorite-mark"
                                    aria-label="お気に入り"
                                >
                                    ${favoriteMark}
                                </span>
                            `
                            : ""
                    }

                    ${
                        accuracy === null
                            ? `
                                <span class="status-label unseen">
                                    未出題
                                </span>
                            `
                            : `
                                <span class="status-label">
                                    ${accuracy}%
                                </span>
                            `
                    }
                </span>
            </button>
        `;
    }

    function groupWords(words) {
        const map = new Map();

        for (const word of words) {
            const source =
                String(
                    word.reading ||
                    word.word ||
                    ""
                )
                    .normalize("NFKC")
                    .trim();

            const group =
                GROUPS.find(
                    (candidate) =>
                        candidate.key !== "他" &&
                        candidate.pattern.test(source)
                ) || {
                    key: "他"
                };

            if (!map.has(group.key)) {
                map.set(
                    group.key,
                    []
                );
            }

            map.get(group.key).push(word);
        }

        for (const groupWords of map.values()) {
            groupWords.sort(compareWords);
        }

        const orderedMap = new Map();

        for (const group of GROUPS) {
            if (map.has(group.key)) {
                orderedMap.set(
                    group.key,
                    map.get(group.key)
                );
            }
        }

        return orderedMap;
    }

    function renderDetail(
        container,
        wordId
    ) {
        const word =
            allWords.find(
                (item) =>
                    String(item.id) ===
                    String(wordId)
            );

        if (!word) {
            container.innerHTML = `
                <section class="card error-card">
                    <h2>
                        語彙が見つかりません
                    </h2>

                    <button
                        id="detailBackButton"
                        class="primary"
                        type="button"
                    >
                        一覧へ戻る
                    </button>
                </section>
            `;

            container
                .querySelector(
                    "#detailBackButton"
                )
                .addEventListener(
                    "click",
                    () =>
                        Router.show(
                            "dictionary"
                        )
                );

            return;
        }

        const stats =
            Storage.getStats();

        const stat =
            stats[word.id] ||
            stats[String(word.id)] ||
            {
                asked: 0,
                correct: 0,
                wrong: 0,
                streak: 0,
                favorite: false
            };

        const accuracy =
            stat.asked
                ? Utils.percentage(
                    stat.correct,
                    stat.asked
                )
                : 0;

        const mastery =
            getMasteryLabel(stat);

        container.innerHTML = `
            <section class="card word-detail">
                <div class="detail-top-actions">
                    <button
                        id="detailBackButton"
                        class="menuButton compact-button"
                        type="button"
                    >
                        一覧へ戻る
                    </button>

                    <button
                        id="favoriteButton"
                        class="favorite-button ${
                            stat.favorite
                                ? "active"
                                : ""
                        }"
                        type="button"
                        aria-pressed="${
                            stat.favorite
                                ? "true"
                                : "false"
                        }"
                    >
                        ${
                            stat.favorite
                                ? "★ お気に入り"
                                : "☆ お気に入り"
                        }
                    </button>
                </div>

                <p class="eyebrow">
                    WORD DETAIL
                </p>

                <h2 class="detail-word">
                    ${Utils.escapeHtml(word.word)}
                </h2>

                ${
                    word.reading
                        ? `
                            <p class="detail-reading">
                                ${Utils.escapeHtml(word.reading)}
                            </p>
                        `
                        : ""
                }

                <dl class="word-definition-list">
                    <div>
                        <dt>
                            意味
                        </dt>

                        <dd>
                            ${Utils.escapeHtml(word.meaning)}
                        </dd>
                    </div>

                    ${
                        word.description
                            ? `
                                <div>
                                    <dt>
                                        解説
                                    </dt>

                                    <dd>
                                        ${Utils.escapeHtml(word.description)}
                                    </dd>
                                </div>
                            `
                            : ""
                    }

                    <div>
                        <dt>
                            カテゴリ
                        </dt>

                        <dd>
                            ${Utils.escapeHtml(word.category || "未分類")}
                        </dd>
                    </div>
                </dl>

                <section class="detail-stats-grid">
                    ${createDetailStat(
                        "習熟度",
                        mastery
                    )}

                    ${createDetailStat(
                        "正答率",
                        stat.asked
                            ? `${accuracy}%`
                            : "--"
                    )}

                    ${createDetailStat(
                        "出題回数",
                        String(stat.asked || 0)
                    )}

                    ${createDetailStat(
                        "連続正解",
                        String(stat.streak || 0)
                    )}
                </section>

                <button
                    id="singleWordQuizButton"
                    class="primary"
                    type="button"
                >
                    この語を含む復習を始める
                </button>
            </section>
        `;

        container
            .querySelector(
                "#detailBackButton"
            )
            .addEventListener(
                "click",
                () =>
                    Router.show(
                        "dictionary"
                    )
            );

        container
            .querySelector(
                "#favoriteButton"
            )
            .addEventListener(
                "click",
                () => {
                    Storage.toggleFavorite(
                        word.id
                    );

                    renderDetail(
                        container,
                        word.id
                    );
                }
            );

        container
            .querySelector(
                "#singleWordQuizButton"
            )
            .addEventListener(
                "click",
                () => {
                    const relatedWords =
                        getRelatedWords(
                            word,
                            4
                        );

                    App.startQuiz({
                        words: relatedWords,
                        questionCount:
                            Math.min(
                                relatedWords.length,
                                5
                            )
                    });
                }
            );
    }

    function createDetailStat(
        label,
        value
    ) {
        return `
            <article class="detail-stat">
                <span>
                    ${Utils.escapeHtml(label)}
                </span>

                <strong>
                    ${Utils.escapeHtml(value)}
                </strong>
            </article>
        `;
    }

    function getMasteryLabel(stat) {
        if (!stat || !stat.asked) {
            return "未出題";
        }

        const accuracy =
            stat.correct /
            stat.asked;

        if (
            stat.asked >= 5 &&
            accuracy >= 0.9 &&
            stat.streak >= 3
        ) {
            return "習得";
        }

        if (accuracy >= 0.75) {
            return "得意";
        }

        if (accuracy >= 0.55) {
            return "普通";
        }

        if (accuracy >= 0.35) {
            return "苦手";
        }

        return "かなり苦手";
    }

    function getRelatedWords(
        target,
        count
    ) {
        const sameCategory =
            allWords
                .filter(
                    (word) =>
                        String(word.id) !==
                            String(target.id) &&
                        word.category ===
                            target.category
                )
                .sort(
                    (a, b) =>
                        Math.abs(
                            a.word.length -
                            target.word.length
                        ) -
                        Math.abs(
                            b.word.length -
                            target.word.length
                        )
                );

        const otherWords =
            allWords.filter(
                (word) =>
                    String(word.id) !==
                        String(target.id) &&
                    !sameCategory.some(
                        (candidate) =>
                            String(candidate.id) ===
                            String(word.id)
                    )
            );

        return [
            target,
            ...sameCategory,
            ...Utils.shuffle(otherWords)
        ].slice(
            0,
            Math.max(count, 4)
        );
    }

    return {
        render,
        getMasteryLabel
    };
})();