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
                "難易度を見直した改訂版。牽強付会・撞着・掣肘など、抽象的な論理や修辞を読み解く100語。",
            file:
                "packs/intermediate-100.json"
        },
        {
            packId: "advanced-100",
            name: "上級100",
            description:
                "難易度を見直した改訂版。肯綮・剔抉・郢書燕説など、難解な漢語と故事成語を掘り下げる100語。",
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
                <div class="page-heading">
                    <div>
                        <p class="eyebrow">WORD PACKS</p>
                        <h2>語彙パック</h2>

                        <p class="page-description">
                            難易度別の語彙をまとめて追加できます。
                            追加した語彙は通常の語彙と同じように
                            編集・削除・クイズできます。
                        </p>
                    </div>
                    <button id="backHomeButton" class="menuButton compact-button" type="button">
                        設定へ戻る
                    </button>
                </div>

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
                                    ${pack.packId !== "beginner-100" ? '<p class="settings-description">改訂版では40語を入れ替えています。登録済みの場合も「追加する」で未登録語を取り込めます。以前の語彙と学習記録は残ります。</p>' : ''}

                                    <div class="pack-preview-actions">
                                        <button class="menuButton" type="button" data-pack-preview="${pack.packId}">100語の一覧を見る</button>
                                        <button class="menuButton" type="button" data-pack-trial="${pack.packId}">お試しクイズ（10問）</button>
                                    </div>
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
            </section>
        `;

        container
            .querySelector(
                "#backHomeButton"
            )
            .addEventListener(
                "click",
                () =>
                    Router.show("settings")
            );

        container.querySelectorAll("[data-pack-preview]").forEach(button => {
            button.onclick = () => Router.show("packPreview", { packId: button.dataset.packPreview });
        });
        container.querySelectorAll("[data-pack-trial]").forEach(button => {
            button.onclick = () => Router.show("packPreview", { packId: button.dataset.packTrial, trial: true });
        });

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

                            const skippedText =
                                Array.isArray(result.skippedWords) &&
                                result.skippedWords.length > 0
                                    ? `\n\nユーザー語彙のため追加しなかった語彙：\n${result.skippedWords.join("、")}`
                                    : "";

                            alert(
                                `${pack.name}を追加しました。\n\n` +
                                `追加：${result.addedCount}語\n` +
                                `スキップ：${result.skippedCount}語` +
                                skippedText
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

                            const packData =
                                await loadPack(packId);

                            const currentVocabulary =
                                Storage.getVocabulary();

                            const packWordKeys =
                                new Set(
                                    packData.words.map(
                                        (item) =>
                                            Storage.normalizeWordKey(
                                                item.word
                                            )
                                    )
                                );

                            const remainingWords =
                                currentVocabulary
                                    .filter((item) => {
                                        const key =
                                            Storage.normalizeWordKey(
                                                item.word
                                            );

                                        return (
                                            packWordKeys.has(key) &&
                                            String(item.packId || "") !==
                                                String(packId)
                                        );
                                    })
                                    .map(
                                        (item) => item.word
                                    );

                            const result =
                                Storage
                                    .removeVocabularyPack(
                                        packId
                                    );

                            await App.reloadWords();

                            const remainingText =
                                remainingWords.length > 0
                                    ? `\n\nユーザー語彙として残った語彙：\n${remainingWords.join("、")}`
                                    : "";

                            alert(
                                `${pack?.name || "語彙パック"}を削除しました。\n\n` +
                                `削除：${result.removedCount}語\n` +
                                `ユーザー語彙として残存：${remainingWords.length}語` +
                                remainingText
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
