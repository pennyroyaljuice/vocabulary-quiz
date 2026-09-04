"use strict";

const WordPacks = (() => {
    const PACKS = [
        {
            packId: "beginner-100",
            name: "初級100",
            description:
                "日常的な文章やニュースを読むうえで役立つ基本語彙。",
            file:
                "packs/beginner-100.json"
        },
        {
            packId: "intermediate-100",
            name: "中級100",
            description:
                "新聞・評論・小説などでよく見かける一段上の語彙。",
            file:
                "packs/intermediate-100.json"
        },
        {
            packId: "advanced-100",
            name: "上級100",
            description:
                "文学・評論・高度な文章の読解に役立つ難度の高い語彙。",
            file:
                "packs/advanced-100.json"
        }
    ];

    function getPacks() {
        return PACKS.map(
            (pack) => ({
                ...pack
            })
        );
    }

    function getPack(
        packId
    ) {
        return PACKS.find(
            (pack) =>
                pack.packId === packId
        ) || null;
    }

    async function loadPack(
        packId
    ) {
        const definition =
            getPack(packId);

        if (!definition) {
            throw new Error(
                "語彙パックが見つかりません。"
            );
        }

        const response =
            await fetch(
                definition.file,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `語彙パックを読み込めませんでした。(${response.status})`
            );
        }

        const data =
            await response.json();

        if (
            !data ||
            typeof data !== "object" ||
            data.packId !== packId ||
            !Array.isArray(data.words)
        ) {
            throw new Error(
                "語彙パックのデータ形式が不正です。"
            );
        }

        return data;
    }

    function render(container) {
        const packs =
            getPacks();

        container.innerHTML = `
            <section class="panel">
                <h2>語彙パック</h2>

                <p class="muted">
                    難易度別の語彙をまとめて追加できます。
                    追加した語彙は通常の語彙と同じように
                    編集・削除・クイズできます。
                </p>

                <div class="word-pack-list">
                    ${packs
                        .map((pack) => {
                            const status =
                                Storage
                                    .getVocabularyPackStatus(
                                        pack.packId
                                    );

                            return `
                                <article class="word-pack-card">
                                    <div class="word-pack-card-header">
                                        <h3>
                                            ${pack.name}
                                        </h3>

                                        <span class="muted">
                                            追加済み：
                                            ${status.installedCount}語
                                        </span>
                                    </div>

                                    <p>
                                        ${pack.description}
                                    </p>

                                    <button
                                        class="primary"
                                        type="button"
                                        data-pack-add="${pack.packId}"
                                    >
                                        追加する
                                    </button>

                                    ${
                                        status.installedCount > 0
                                            ? `
                                                <button
                                                    class="menuButton"
                                                    type="button"
                                                    data-pack-remove="${pack.packId}"
                                                >
                                                    このパックの語彙を削除
                                                </button>
                                            `
                                            : ""
                                    }
                                </article>
                            `;
                        })
                        .join("")}
                </div>

                <button
                    id="backHomeButton"
                    class="secondary"
                    type="button"
                >
                    ホームに戻る
                </button>
            </section>
        `;

        container
            .querySelector(
                "#backHomeButton"
            )
            .addEventListener(
                "click",
                () =>
                    Router.show("home")
            );

        container
            .querySelectorAll(
                "[data-pack-add]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const packId =
                            button.dataset.packAdd;

                        const originalText =
                            button.textContent;

                        try {
                            button.disabled = true;
                            button.textContent =
                                "追加中...";

                            const pack =
                                await loadPack(
                                    packId
                                );

                            const result =
                                Storage
                                    .addVocabularyPack(
                                        pack
                                    );

                            await App.reloadWords();

                            alert(
                                
                                `${result.addedCount}語を追加しました。` +
                                (
                                    result.skippedCount
                                        ? ` ${result.skippedCount}語は登録済みなどのためスキップしました。`
                                        : ""
                                )
                            );

                            render(container);
                        } catch (error) {
                            console.error(error);

                            alert(
                                error?.message ||
                                "語彙パックの追加に失敗しました。"
                            );

                            button.disabled = false;
                            button.textContent =
                                originalText;
                        }
                    }
                );
            });

        container
            .querySelectorAll(
                "[data-pack-remove]"
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    async () => {
                        const packId =
                            button.dataset.packRemove;

                        const pack =
                            getPack(packId);

                        const confirmed =
                            confirm(
                                `${pack?.name || "このパック"}から追加した語彙を削除します。\nよろしいですか？`
                            );

                        if (!confirmed) {
                            return;
                        }

                        try {
                            button.disabled = true;
                            button.textContent =
                                "削除中...";

                            const result =
                                Storage
                                    .removeVocabularyPack(
                                        packId
                                    );

                            await App.reloadWords();

                            alert(
                                `${result.removedCount}語を削除しました。`
                            );

                            render(container);
                        } catch (error) {
                            console.error(error);

                            alert(
                                error?.message ||
                                "語彙パックの削除に失敗しました。"
                            );

                            render(container);
                        }
                    }
                );
            });
            
    }

    return {
        getPacks,
        getPack,
        loadPack,
        render
    };
})();