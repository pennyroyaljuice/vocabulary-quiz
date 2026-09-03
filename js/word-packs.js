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

    return {
        getPacks,
        getPack,
        loadPack
    };
})();