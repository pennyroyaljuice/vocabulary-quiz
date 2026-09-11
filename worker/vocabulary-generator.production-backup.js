const ALLOWED_ORIGINS = new Set([
    "https://pennyroyaljuice.github.io",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
]);

const MODEL =
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast";


const VOCABULARY_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        word: {
            type: "string"
        },

        reading: {
            type: "string"
        },

        meaning: {
            type: "string"
        },

        description: {
            type: "string"
        },

        category: {
            type: "string"
        },

        quizTypes: {
            type: "array",

            items: {
                type: "string",

                enum: [
                    "wordToMeaning",
                    "meaningToWord",
                    "reading"
                ]
            }
        },

        needsReview: {
            type: "boolean"
        },

        comparisonNote: {
            type: "string"
        }
    },

    required: [
        "word",
        "reading",
        "meaning",
        "description",
        "category",
        "quizTypes",
        "needsReview",
        "comparisonNote"
    ]
};


const JAPANESE_TEXT_SCHEMA = {
    type: "object",
    additionalProperties: false,

    properties: {
        meaning: {
            type: "string"
        },

        description: {
            type: "string"
        }
    },

    required: [
        "meaning",
        "description"
    ]
};


export default {
    async fetch(request, env) {
        const origin =
            request.headers.get("Origin") || "";

        const corsHeaders =
            createCorsHeaders(origin);


        if (request.method === "OPTIONS") {
            return new Response(
                null,
                {
                    status:
                        ALLOWED_ORIGINS.has(origin)
                            ? 204
                            : 403,

                    headers:
                        corsHeaders
                }
            );
        }


        if (request.method === "GET") {
            return jsonResponse(
                {
                    status: "ok",

                    message:
                        "Vocabulary Generator API is running.",

                    model:
                        MODEL
                },

                200,

                corsHeaders
            );
        }


        if (request.method !== "POST") {
            return jsonResponse(
                {
                    error:
                        "POSTメソッドを使用してください。"
                },

                405,

                corsHeaders
            );
        }


        if (!ALLOWED_ORIGINS.has(origin)) {
            return jsonResponse(
                {
                    error:
                        "このWebサイトからのアクセスは許可されていません。"
                },

                403,

                corsHeaders
            );
        }


        if (!env.AI) {
            return jsonResponse(
                {
                    error:
                        "Workers AIのバインディングが設定されていません。"
                },

                500,

                corsHeaders
            );
        }


        try {
            const body =
                await request.json();

            const word =
                cleanWord(
                    body.word
                );

            const readingHint =
                String(
                    body.readingHint || ""
                ).trim();

            const contextHint =
                String(
                    body.contextHint || ""
                ).trim();

            const dictionaryHint =
                String(
                    body.dictionaryHint || ""
                ).trim();


            if (!word) {
                return jsonResponse(
                    {
                        error:
                            "語彙を入力してください。"
                    },

                    400,

                    corsHeaders
                );
            }


            if (word.length > 100) {
                return jsonResponse(
                    {
                        error:
                            "語彙が長すぎます。"
                    },

                    400,

                    corsHeaders
                );
            }


            /*
             * dictionaryHint から
             * 読み候補・品詞を先に抽出する。
             *
             * AIではなくJMdict側の情報を
             * 最終検証にも利用する。
             */
            const dictionaryInfo =
                parseDictionaryHint(
                    dictionaryHint
                );


            /*
             * 1回目の生成
             */
            const firstResult =
                await runVocabularyGeneration(
                    env,
                    {
                        word,
                        readingHint,
                        contextHint,
                        dictionaryHint,
                        isRetry: false
                    }
                );


            /*
             * AIレスポンスを取得。
             *
             * JSONとして読み取れなかった場合だけ
             * 1回だけ再試行する。
             */
            let generated;

            try {
                generated =
                    extractVocabulary(
                        firstResult
                    );
            } catch (firstError) {
                console.warn(
                    "AI結果を読み取れなかったため、1回だけ再試行します。",
                    firstError
                );


                const retryResult =
                    await runVocabularyGeneration(
                        env,
                        {
                            word,
                            readingHint,
                            contextHint,
                            dictionaryHint,
                            isRetry: true
                        }
                    );


                generated =
                    extractVocabulary(
                        retryResult
                    );
            }


            /*
             * 読み・quizTypes等を正規化
             */
            let normalized =
                normalizeVocabulary({
                    generated,
                    originalWord:
                        word,
                    readingHint,
                    dictionaryInfo
                });


            /*
             * meaning / description が
             * 英語だけの場合、
             * 語彙全体は作り直さず
             * その2項目だけ日本語へ補正する。
             */
            if (
                needsJapaneseRepair(
                    normalized
                )
            ) {
                try {
                    const repaired =
                        await repairJapaneseText(
                            env,
                            {
                                word,
                                meaning:
                                    normalized.meaning,

                                description:
                                    normalized.description,

                                dictionaryHint
                            }
                        );


                    if (repaired.meaning) {
                        normalized.meaning =
                            repaired.meaning;
                    }


                    if (
                        repaired.description ||
                        !normalized.description
                    ) {
                        normalized.description =
                            repaired.description;
                    }
                } catch (repairError) {
                    console.warn(
                        "日本語フィールドの補正に失敗しました。",
                        repairError
                    );
                }
            }


            /*
             * 最終ガード：
             *
             * 英語meaningをそのまま
             * アプリへ返すことは禁止。
             */
            if (
                !normalized.meaning ||
                looksLikeEnglishOnly(
                    normalized.meaning
                )
            ) {
                throw new Error(
                    "AIが日本語の意味を生成できませんでした。再度お試しください。"
                );
            }


            /*
             * description は補助情報なので、
             * 英語しか残らなかった場合は
             * 誤情報を出すより空欄にする。
             */
            if (
                looksLikeEnglishOnly(
                    normalized.description
                )
            ) {
                normalized.description =
                    "";

                normalized.needsReview =
                    true;

                normalized.comparisonNote =
                    appendComparisonNote(
                        normalized.comparisonNote,
                        "補足説明は要確認です。"
                    );
            }


            /*
             * category はAIの値を
             * そのまま信用しない。
             *
             * JMdictの品詞を最優先して
             * 必ずここで確定する。
             */
            normalized.category =
                normalizeCategory({
                    generatedCategory:
                        normalized.category,

                    partOfSpeech:
                        dictionaryInfo.partOfSpeech
                });


            return jsonResponse(
                {
                    vocabulary:
                        normalized
                },

                200,

                corsHeaders
            );

        } catch (error) {
            console.error(
                "AI ERROR:",
                error
            );

            console.error(
                "STACK:",
                error?.stack
            );


            return jsonResponse(
                {
                    error:
                        "語彙情報の生成中にエラーが発生しました。",

                    detail:
                        String(
                            error?.message ||
                            error
                        )
                },

                500,

                corsHeaders
            );
        }
    }
};


/*
 * AIへ語彙生成を依頼
 */
async function runVocabularyGeneration(
    env,
    {
        word,
        readingHint,
        contextHint,
        dictionaryHint,
        isRetry
    }
) {
    return env.AI.run(
        MODEL,
        {
            messages: [
                {
                    role:
                        "system",

                    content:
                        createSystemPrompt(
                            isRetry
                        )
                },

                {
                    role:
                        "user",

                    content:
                        createUserPrompt({
                            word,
                            readingHint,
                            contextHint,
                            dictionaryHint
                        })
                }
            ],

            response_format: {
                type:
                    "json_schema",

                json_schema:
                    VOCABULARY_SCHEMA
            },

            temperature:
                isRetry
                    ? 0
                    : 0.1,

            max_tokens:
                700
        }
    );
}


/*
 * 語彙生成用System Prompt
 */
function createSystemPrompt(
    isRetry
) {
    return `
あなたは日本語辞典の編集者です。
入力された見出し語について、語彙学習クイズ用の辞書データを作成してください。

必須ルール：

- JSON Schemaに厳密に従う。
- JSON以外の文章、Markdown、コードフェンス、思考過程を出力しない。
- word は入力された見出し語の表記を変更しない。

meaning：
- 必ず自然で簡潔な日本語にする。
- 英語の語義をそのまま残さない。
- 辞書情報がある場合はその内容を最優先する。

description：
- 原則として日本語にする。
- 用法や意味上の補足を簡潔に書く。
- 不確かな語源、使用頻度、一般性を断定しない。

category：
- 必ず日本語の品詞または語種名にする。
- 例：「名詞」「動詞」「形容詞」「副詞」「慣用表現」。
- reading、wordToMeaning、meaningToWord を入れてはいけない。
- noun、verb、adjective、adverb 等の英語をそのまま入れてはいけない。

reading：
- 原則ひらがなにする。
- カタカナ語や英字語では空文字にしてよい。

quizTypes：
- wordToMeaning と meaningToWord は原則含める。
- カタカナ語、英字語、慣用句、ことわざ、長い文章表現では reading を原則含めない。

readingHint がある場合：
- 利用者が想定している読み候補として扱う。
- 正当な読みとして成立するならそのまま採用する。
- 明確に誤っている場合だけ修正する。
- 修正した場合は needsReview=true とし、comparisonNote に理由を書く。

contextHint がある場合：
- その文脈に合う語義を優先する。

dictionaryHint がある場合：
- 外部辞書情報をモデル自身の推測より優先する。
- 読み候補がある場合、reading はその候補の中から選ぶ。
- 英語の語義は内容を保ったまま自然な日本語にする。
- 辞書にない意味、語源、一般性、使用頻度を追加しない。

判断に大きな不確実性が残る場合：
- needsReview=true にする。
- comparisonNote に確認点だけを短く書く。

特に問題がなければ：
- needsReview=false
- comparisonNote=""
${
    isRetry
        ? "- これは再試行です。JSON形式、日本語meaning、日本語categoryを特に厳守する。"
        : ""
}
    `.trim();
}


/*
 * User Prompt
 */
function createUserPrompt({
    word,
    readingHint,
    contextHint,
    dictionaryHint
}) {
    return [
        `見出し語：${word}`,

        readingHint
            ? `利用者が想定している読み候補：${readingHint}`
            : "利用者から読み候補の指定はありません。",

        contextHint
            ? `文脈・分野のヒント：${contextHint}`
            : "文脈・分野の補足はありません。",

        dictionaryHint
            ? `外部辞書情報：
${dictionaryHint}`
            : "外部辞書情報はありません。",

        "meaning は必ず日本語、category も必ず日本語で返してください。"
    ]
        .join("\n\n");
}


/*
 * AI生成結果をアプリ用データへ正規化
 */
function normalizeVocabulary({
    generated,
    originalWord,
    readingHint,
    dictionaryInfo
}) {
    if (
        !generated ||
        typeof generated !== "object"
    ) {
        throw new Error(
            "AIの生成結果が不正です。"
        );
    }


    /*
     * quizTypesをホワイトリスト化
     */
    const quizTypes =
        Array.isArray(
            generated.quizTypes
        )
            ? generated.quizTypes.filter(
                (type) =>
                    [
                        "wordToMeaning",
                        "meaningToWord",
                        "reading"
                    ].includes(type)
            )
            : [];


    const uniqueQuizTypes =
        [...new Set(quizTypes)];


    if (
        !uniqueQuizTypes.includes(
            "wordToMeaning"
        )
    ) {
        uniqueQuizTypes.unshift(
            "wordToMeaning"
        );
    }


    if (
        !uniqueQuizTypes.includes(
            "meaningToWord"
        )
    ) {
        uniqueQuizTypes.push(
            "meaningToWord"
        );
    }


    /*
     * reading決定
     *
     * 優先順位：
     *
     * 1. 正当なreadingHint
     * 2. JMdict唯一候補
     * 3. JMdict複数候補のうちAIが選んだもの
     * 4. 辞書候補が無ければAI
     */
    const generatedReading =
        normalizeReading(
            generated.reading
        );

    const hintReading =
        normalizeReading(
            readingHint
        );

    const candidates =
        [
            ...new Set(
                dictionaryInfo.readings
                    .map(
                        normalizeReading
                    )
                    .filter(Boolean)
            )
        ];


    let reading =
        "";

    let needsReview =
        generated.needsReview === true;

    let comparisonNote =
        String(
            generated.comparisonNote ||
            ""
        ).trim();


    if (hintReading) {
        /*
         * 辞書候補無し：
         * readingHintを採用。
         *
         * 辞書候補あり：
         * 候補内ならreadingHintを採用。
         */
        if (
            candidates.length === 0 ||
            candidates.includes(
                hintReading
            )
        ) {
            reading =
                hintReading;
        } else {
            /*
             * 利用者の読みとJMdictが
             * 食い違っている場合は
             * 黙ってどちらかを正解にしない。
             */
            reading =
                candidates.includes(
                    generatedReading
                )
                    ? generatedReading
                    : (
                        candidates[0] ||
                        hintReading
                    );


            needsReview =
                true;

            comparisonNote =
                appendComparisonNote(
                    comparisonNote,
                    "指定された読みと外部辞書の候補が一致しないため確認が必要です。"
                );
        }

    } else if (
        candidates.length === 1
    ) {
        /*
         * 辞書読みが一つなら
         * AIに決めさせない。
         */
        reading =
            candidates[0];

    } else if (
        candidates.length > 1
    ) {
        /*
         * 候補が複数なら
         * AIは候補内からのみ選択可。
         */
        reading =
            candidates.includes(
                generatedReading
            )
                ? generatedReading
                : candidates[0];


        /*
         * どの読みが意図されたものか
         * JMdictだけで決められないため
         * 要確認にする。
         */
        needsReview =
            true;

        comparisonNote =
            appendComparisonNote(
                comparisonNote,
                `読み候補が複数あります：${candidates.join(" / ")}`
            );

    } else {
        /*
         * JMdictに無い場合だけ
         * AI reading を採用。
         */
        reading =
            generatedReading;
    }


    /*
     * 読みが無いなら
     * readingクイズも禁止
     */
    if (!reading) {
        const readingIndex =
            uniqueQuizTypes.indexOf(
                "reading"
            );

        if (
            readingIndex >= 0
        ) {
            uniqueQuizTypes.splice(
                readingIndex,
                1
            );
        }
    }


    return {
        word:
            originalWord,

        reading,

        meaning:
            String(
                generated.meaning ||
                ""
            ).trim(),

        description:
            String(
                generated.description ||
                ""
            ).trim(),

        /*
         * ここでは一旦保持するだけ。
         * 最後にnormalizeCategoryで
         * 再判定する。
         */
        category:
            String(
                generated.category ||
                ""
            ).trim(),

        quizTypes:
            uniqueQuizTypes,

        needsReview,

        comparisonNote
    };
}


/*
 * dictionaryHintから
 * 読みと品詞を取得
 *
 * 現在のフロント側形式：
 *
 * 候補1
 * 読み: ...
 * 品詞: ...
 * 意味: ...
 */
function parseDictionaryHint(
    dictionaryHint
) {
    const text =
        String(
            dictionaryHint ||
            ""
        );


    const readings =
        [];

    const partOfSpeech =
        [];


    for (
        const rawLine
        of text.split(
            /\r?\n/u
        )
    ) {
        const line =
            rawLine.trim();


        const readingMatch =
            line.match(
                /^読み\s*[:：]\s*(.+)$/u
            );


        if (readingMatch) {
            readings.push(
                ...splitDictionaryValues(
                    readingMatch[1]
                )
            );

            continue;
        }


        const posMatch =
            line.match(
                /^品詞\s*[:：]\s*(.+)$/u
            );


        if (posMatch) {
            partOfSpeech.push(
                ...splitDictionaryValues(
                    posMatch[1]
                )
            );
        }
    }


    return {
        readings:
            [
                ...new Set(
                    readings
                        .map(
                            (value) =>
                                value.trim()
                        )
                        .filter(Boolean)
                )
            ],

        partOfSpeech:
            [
                ...new Set(
                    partOfSpeech
                        .map(
                            (value) =>
                                value.trim()
                        )
                        .filter(Boolean)
                )
            ]
    };
}


function splitDictionaryValues(
    value
) {
    return String(
        value ||
        ""
    )
        .split(
            /[,、/／|｜;；]+/u
        )
        .map(
            (item) =>
                item.trim()
        )
        .filter(Boolean);
}


/*
 * categoryの最終決定
 *
 * JMdictのPOSを最優先する。
 */
function normalizeCategory({
    generatedCategory,
    partOfSpeech
}) {
    /*
     * JMdictに品詞があれば
     * AIカテゴリより優先。
     */
    const fromPos =
        categoryFromPartOfSpeech(
            partOfSpeech
        );


    if (fromPos) {
        return fromPos;
    }


    /*
     * JMdict品詞が無い場合のみ
     * AIカテゴリを救済利用。
     */
    const category =
        String(
            generatedCategory ||
            ""
        ).trim();


    if (!category) {
        return "未分類";
    }


    const lower =
        category
            .toLowerCase();


    /*
     * quizTypesを誤ってcategoryへ
     * 入れたケースを完全排除。
     */
    if (
        [
            "reading",
            "wordtomeaning",
            "meaningtoword"
        ].includes(
            lower
        )
    ) {
        return "未分類";
    }


    /*
     * 単純な英語品詞だけは
     * 安全に日本語化できる。
     */
    const exactEnglishMap = {
        noun:
            "名詞",

        verb:
            "動詞",

        adjective:
            "形容詞",

        adverb:
            "副詞",

        expression:
            "表現",

        phrase:
            "表現",

        idiom:
            "慣用表現",

        proverb:
            "ことわざ",

        conjunction:
            "接続詞",

        interjection:
            "感動詞",

        prefix:
            "接頭辞",

        suffix:
            "接尾辞",

        pronoun:
            "代名詞",

        particle:
            "助詞",

        auxiliary:
            "助動詞"
    };


    if (
        exactEnglishMap[
            lower
        ]
    ) {
        return exactEnglishMap[
            lower
        ];
    }


    /*
     * 日本語を含むカテゴリなら
     * AI値を利用可能。
     */
    if (
        containsJapanese(
            category
        )
    ) {
        return category;
    }


    /*
     * 未知の英語・不明値は
     * 表に出さない。
     */
    return "未分類";
}


/*
 * JMdict POSコード
 * → アプリ向け日本語カテゴリ
 */
function categoryFromPartOfSpeech(
    partOfSpeech
) {
    const codes =
        (
            partOfSpeech ||
            []
        )
            .map(
                (value) =>
                    String(
                        value
                    ).toLowerCase()
            );


    if (!codes.length) {
        return "";
    }


    const has =
        (pattern) =>
            codes.some(
                (code) =>
                    pattern.test(
                        code
                    )
            );


    /*
     * JMdict：
     * v5r, vi, vt, v1, vs 等
     */
    if (
        has(
            /^(v|vs|vk|vz|cop)/u
        )
    ) {
        return "動詞";
    }


    if (
        has(
            /^adj-i/u
        )
    ) {
        return "形容詞";
    }


    if (
        has(
            /^adj-na/u
        )
    ) {
        return "形容動詞";
    }


    if (
        has(
            /^adj-/u
        )
    ) {
        return "形容詞";
    }


    if (
        has(
            /^adv/u
        )
    ) {
        return "副詞";
    }


    if (
        has(
            /^n(?:-|$)/u
        )
    ) {
        return "名詞";
    }


    if (
        has(
            /^pron/u
        )
    ) {
        return "代名詞";
    }


    if (
        has(
            /^conj/u
        )
    ) {
        return "接続詞";
    }


    if (
        has(
            /^int/u
        )
    ) {
        return "感動詞";
    }


    if (
        has(
            /^prt/u
        )
    ) {
        return "助詞";
    }


    if (
        has(
            /^aux/u
        )
    ) {
        return "助動詞";
    }


    if (
        has(
            /^pref/u
        )
    ) {
        return "接頭辞";
    }


    if (
        has(
            /^suf/u
        )
    ) {
        return "接尾辞";
    }


    if (
        has(
            /^exp/u
        )
    ) {
        return "表現";
    }


    return "";
}


/*
 * 読みの比較用正規化
 */
function normalizeReading(
    value
) {
    return String(
        value ||
        ""
    )
        .trim()
        .replace(
            /\s+/gu,
            ""
        );
}


/*
 * meaning / description の
 * 日本語補正が必要か判定
 */
function needsJapaneseRepair(
    vocabulary
) {
    return (
        looksLikeEnglishOnly(
            vocabulary.meaning
        ) ||
        looksLikeEnglishOnly(
            vocabulary.description
        )
    );
}


/*
 * meaning / descriptionだけを
 * 日本語へ補正する。
 *
 * readingやcategory等は
 * 触らせない。
 */
async function repairJapaneseText(
    env,
    {
        word,
        meaning,
        description,
        dictionaryHint
    }
) {
    const result =
        await env.AI.run(
            MODEL,
            {
                messages: [
                    {
                        role:
                            "system",

                        content: `
あなたは日本語辞典の編集者です。

meaning と description だけを日本語に補正してください。

必須ルール：

- JSON Schemaに厳密に従う。
- meaning は必ず自然で簡潔な日本語にする。
- description も日本語にする。補足が不要なら空文字でよい。
- 外部辞書情報がある場合は、その語義を最優先する。
- 辞書にない意味、語源、使用頻度、一般性を追加しない。
- 英語の語義は自然な日本語へ翻訳し、英語のまま残さない。
- JSON以外の文章を出力しない。
                        `.trim()
                    },

                    {
                        role:
                            "user",

                        content: [
                            `見出し語：${word}`,

                            `現在のmeaning：
${meaning || ""}`,

                            `現在のdescription：
${description || ""}`,

                            dictionaryHint
                                ? `外部辞書情報：
${dictionaryHint}`
                                : ""
                        ]
                            .filter(Boolean)
                            .join("\n\n")
                    }
                ],

                response_format: {
                    type:
                        "json_schema",

                    json_schema:
                        JAPANESE_TEXT_SCHEMA
                },

                temperature:
                    0,

                max_tokens:
                    300
            }
        );


    const repaired =
        extractObject(
            result
        );


    return {
        meaning:
            String(
                repaired.meaning ||
                ""
            ).trim(),

        description:
            String(
                repaired.description ||
                ""
            ).trim()
    };
}


/*
 * Vocabulary結果取得
 */
function extractVocabulary(
    result
) {
    return extractObject(
        result
    );
}


/*
 * Workers AIの複数形式に対応
 */
function extractObject(
    result
) {
    /*
     * JSON Schema利用時に
     * objectが直接返る形式
     */
    if (
        result &&
        typeof result.response ===
            "object" &&
        result.response !== null &&
        !Array.isArray(
            result.response
        )
    ) {
        return result.response;
    }


    /*
     * 一般的なresponse文字列
     */
    if (
        typeof result?.response ===
            "string" &&
        result.response.trim()
    ) {
        return parseGeneratedJson(
            result.response
        );
    }


    /*
     * output_text
     */
    if (
        typeof result?.output_text ===
            "string" &&
        result.output_text.trim()
    ) {
        return parseGeneratedJson(
            result.output_text
        );
    }


    /*
     * Responses API output[]
     */
    if (
        Array.isArray(
            result?.output
        )
    ) {
        const texts =
            [];


        for (
            const outputItem
            of result.output
        ) {
            if (
                typeof outputItem?.text ===
                    "string"
            ) {
                texts.push(
                    outputItem.text
                );
            }


            if (
                Array.isArray(
                    outputItem?.content
                )
            ) {
                for (
                    const contentItem
                    of outputItem.content
                ) {
                    if (
                        typeof contentItem?.text ===
                            "string"
                    ) {
                        texts.push(
                            contentItem.text
                        );
                    }


                    if (
                        typeof contentItem?.output_text ===
                            "string"
                    ) {
                        texts.push(
                            contentItem.output_text
                        );
                    }
                }
            }
        }


        const outputText =
            texts
                .join("\n")
                .trim();


        if (outputText) {
            return parseGeneratedJson(
                outputText
            );
        }
    }


    /*
     * Chat Completions
     */
    const choiceContent =
        result
            ?.choices
            ?.[0]
            ?.message
            ?.content;


    if (
        typeof choiceContent ===
            "string" &&
        choiceContent.trim()
    ) {
        return parseGeneratedJson(
            choiceContent
        );
    }


    /*
     * Text Completion
     */
    const choiceText =
        result
            ?.choices
            ?.[0]
            ?.text;


    if (
        typeof choiceText ===
            "string" &&
        choiceText.trim()
    ) {
        return parseGeneratedJson(
            choiceText
        );
    }


    console.error(
        "UNKNOWN AI RESULT:",
        JSON.stringify(
            result,
            null,
            2
        )
    );


    throw new Error(
        "AIの生成結果を読み取れませんでした。"
    );
}


/*
 * JSON救済パーサー
 */
function parseGeneratedJson(
    text
) {
    let cleaned =
        String(
            text ||
            ""
        ).trim();


    if (!cleaned) {
        throw new Error(
            "AIの生成結果が空です。"
        );
    }


    /*
     * Qwen thinking除去
     */
    cleaned =
        cleaned
            .replace(
                /<think>[\s\S]*?<\/think>/giu,
                ""
            )
            .trim();


    /*
     * Markdownコードフェンス除去
     */
    const fencedMatch =
        cleaned.match(
            /```(?:json)?\s*([\s\S]*?)```/iu
        );


    if (
        fencedMatch
    ) {
        cleaned =
            fencedMatch[1]
                .trim();
    }


    /*
     * 通常JSON
     */
    try {
        return JSON.parse(
            cleaned
        );
    } catch {
        // 次の救済へ
    }


    /*
     * 前後に余計な文章がある場合
     */
    const start =
        cleaned.indexOf(
            "{"
        );

    const end =
        cleaned.lastIndexOf(
            "}"
        );


    if (
        start !== -1 &&
        end !== -1 &&
        end > start
    ) {
        const jsonText =
            cleaned
                .slice(
                    start,
                    end + 1
                )
                .trim();


        try {
            return JSON.parse(
                jsonText
            );
        } catch (error) {
            console.error(
                "JSON PARSE ERROR:",
                error
            );
        }
    }


    console.error(
        "AI RAW TEXT:",
        cleaned
    );


    throw new Error(
        "AIの生成結果をJSONとして読み取れませんでした。"
    );
}


/*
 * 英語のみの文章か判定。
 *
 * 「AIを利用する」のように
 * 日本語＋英字なら英語扱いしない。
 */
function looksLikeEnglishOnly(
    text
) {
    const value =
        String(
            text ||
            ""
        ).trim();


    if (!value) {
        return false;
    }


    return (
        /[A-Za-z]/u.test(
            value
        ) &&
        !containsJapanese(
            value
        )
    );
}


/*
 * 日本語文字を含むか
 */
function containsJapanese(
    text
) {
    return /[ぁ-んァ-ヶ一-龯々]/u.test(
        String(
            text ||
            ""
        )
    );
}


/*
 * comparisonNote追加
 */
function appendComparisonNote(
    current,
    addition
) {
    const currentText =
        String(
            current ||
            ""
        ).trim();

    const additionText =
        String(
            addition ||
            ""
        ).trim();


    if (!currentText) {
        return additionText;
    }


    if (!additionText) {
        return currentText;
    }


    if (
        currentText.includes(
            additionText
        )
    ) {
        return currentText;
    }


    return `${currentText} ${additionText}`;
}


/*
 * 入力語の簡単な清掃
 */
function cleanWord(
    value
) {
    return String(
        value ||
        ""
    )
        .replace(
            /^[\s・•●○□■\-–—]+/u,
            ""
        )
        .replace(
            /[（(][^）)]*[）)]/gu,
            ""
        )
        .trim();
}


/*
 * CORS
 */
function createCorsHeaders(
    origin
) {
    const headers = {
        "Access-Control-Allow-Methods":
            "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers":
            "Content-Type",

        "Access-Control-Max-Age":
            "86400",

        "Content-Type":
            "application/json; charset=utf-8"
    };


    if (
        ALLOWED_ORIGINS.has(
            origin
        )
    ) {
        headers[
            "Access-Control-Allow-Origin"
        ] =
            origin;

        headers.Vary =
            "Origin";
    }


    return headers;
}


/*
 * JSON Response
 */
function jsonResponse(
    data,
    status,
    headers
) {
    return new Response(
        JSON.stringify(
            data
        ),

        {
            status,
            headers
        }
    );
}