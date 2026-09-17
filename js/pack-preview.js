"use strict";

const PackPreview = (() => {
    const escape = value => Utils.escapeHtml(String(value ?? ""));

    async function render(container, { packId, trial = false }) {
        const root = document.createElement("div");
        root.className = "pack-preview";
        root.innerHTML = '<section class="card"><p role="status">パックを読み込んでいます…</p><button class="menuButton" type="button">語彙パックへ戻る</button></section>';
        root.querySelector("button").onclick = () => Router.show("wordPacks");
        container.replaceChildren(root);
        let pack;
        try { pack = await WordPacks.loadPack(packId); }
        catch (error) {
            root.querySelector("[role=status]").textContent = error.message;
            return;
        }
        if (!container.contains(root)) return;
        let quiz;
        let search = "";
        let count = 10;
        function header(title, description) {
            root.innerHTML = `<section class="card"><div class="page-heading"><div>
                <p class="eyebrow">WORD PACK PREVIEW</p><h2>${escape(pack.name)} · ${escape(title)}</h2>
                <p class="page-description">${escape(description)}</p></div>
                <button class="menuButton compact-button" type="button" data-back>語彙パックへ戻る</button>
                </div></section><section class="card pack-preview-body"></section>`;
            root.querySelector("[data-back]").onclick = () => Router.show("wordPacks");
            root.scrollIntoView({ block: "start", behavior: "instant" });
            return root.querySelector(".pack-preview-body");
        }
        function addButton(body) {
            body.querySelector("[data-add]").onclick = async event => {
                const button = event.target;
                button.disabled = true;
                try {
                    const result = Storage.addVocabularyPack(pack);
                    await App.reloadWords();
                    body.querySelector("[data-add-status]").textContent = `${result.addedCount}語を追加しました。登録済み・登録待ちの${result.skippedCount}語は追加していません。`;
                    button.textContent = "追加済み";
                } catch (error) {
                    body.querySelector("[data-add-status]").textContent = error.message;
                    button.disabled = false;
                }
            };
        }
        function renderList() {
            const body = header("収録語彙", "登録前に読み・意味・補足を確認できます。お試しクイズは学習記録に残りません。");
            body.innerHTML = `<div class="pack-trial-controls">
                <label>お試しの問題数 <select data-count aria-label="お試しの問題数">
                    ${[10, 20, 100].map(value => `<option value="${value}" ${count === value ? 'selected' : ''}>${value}問</option>`).join('')}
                </select></label><button class="primary" type="button" data-trial>お試しクイズを始める</button></div>
                <button class="menuButton" type="button" data-add>この${pack.words.length}語を追加する</button>
                <p role="status" data-add-status></p>
                <label for="packSearch">語彙・読み・意味から検索</label>
                <input class="share-input" id="packSearch" type="search" value="${escape(search)}" placeholder="語彙・読み・意味を入力">
                <p role="status" data-count-status></p><ol class="pack-word-preview"></ol>`;
            body.querySelector("[data-count]").onchange = event => { count = Number(event.target.value); };
            body.querySelector("[data-trial]").onclick = startTrial;
            addButton(body);
            const list = body.querySelector("ol");
            function filter() {
                const term = search.normalize("NFKC").toLocaleLowerCase('ja');
                const matches = pack.words.filter(word => [word.word, word.reading, word.meaning, word.description || word.note]
                    .some(value => String(value || "").normalize("NFKC").toLocaleLowerCase('ja').includes(term)));
                body.querySelector("[data-count-status]").textContent = `${pack.words.length}語中 ${matches.length}語を表示`;
                list.innerHTML = matches.map(word => `<li><h3>${escape(word.word)} <small>${escape(word.reading)}</small></h3>
                    <p>${escape(word.meaning)}</p>${word.description || word.note ? `<details><summary>補足説明</summary><p>${escape(word.description || word.note)}</p></details>` : ''}</li>`).join('');
                if (!matches.length) list.innerHTML = '<li class="pack-empty">一致する語彙はありません。</li>';
            }
            body.querySelector("#packSearch").oninput = event => { search = event.target.value; filter(); };
            filter();
        }
        function startTrial() {
            try {
                quiz = createQuiz({ practice: true });
                quiz.initialize(pack.words.map((word, index) => ({ ...word, id: `trial-${pack.packId}-${index}` })));
                quiz.start({ questionCount: count });
                renderQuestion();
            } catch (error) {
                const body = header("お試しクイズ", "このパックを試す準備ができませんでした。");
                body.innerHTML = `<p role="alert">${escape(error.message)}</p><button class="menuButton" type="button">一覧へ戻る</button>`;
                body.querySelector("button").onclick = renderList;
            }
        }
        function renderQuestion() {
            const question = quiz.getCurrentQuestion();
            if (!question) return renderResult();
            const body = header("お試しクイズ", "このパックだけから出題します。語彙の登録や学習記録の更新は行いません。");
            body.innerHTML = `<p class="eyebrow">${question.number} / ${question.total}問 · ${escape(question.typeLabel)}</p>
                <progress class="pack-trial-progress" max="${question.total}" value="${question.number - 1}" aria-label="お試しクイズの進捗"></progress>
                <p>${escape(question.prompt)}</p><h3 class="pack-trial-question" tabindex="-1">${escape(question.text)}</h3>
                <div class="pack-trial-choices">${question.choices.map((choice, index) => `<button class="menuButton" type="button" data-choice="${index}">${escape(choice)}</button>`).join('')}</div>
                <div class="pack-trial-feedback" aria-live="polite"></div>
                <button class="menuButton" type="button" data-list>お試しを終了して一覧へ</button>`;
            body.querySelector("[data-list]").onclick = renderList;
            body.querySelectorAll("[data-choice]").forEach(button => {
                button.onclick = () => {
                    const result = quiz.answer(question.choices[Number(button.dataset.choice)]);
                    if (!result) return;
                    body.querySelectorAll("[data-choice]").forEach(choice => {
                        choice.disabled = true;
                        if (question.choices[Number(choice.dataset.choice)] === result.correctAnswer) {
                            choice.classList.add("pack-choice-correct");
                            choice.textContent += "（正解）";
                        } else if (choice === button) {
                            choice.classList.add("pack-choice-wrong");
                            choice.textContent += "（選択した回答）";
                        }
                    });
                    const feedback = body.querySelector(".pack-trial-feedback");
                    feedback.innerHTML = `<h3>${result.correct ? '正解です' : '不正解です'}</h3><p>正解：${escape(result.correctAnswer)}</p>
                        <p><strong>${escape(result.word.word)}</strong> ${escape(result.reading)}</p><p>${escape(result.meaning)}</p>
                        ${result.description || result.word.note ? `<p class="pack-trial-note">${escape(result.description || result.word.note)}</p>` : ''}
                        <button class="primary" type="button">${question.number === question.total ? '結果を見る' : '次の問題へ'}</button>`;
                    feedback.querySelector("button").onclick = () => { quiz.next(); renderQuestion(); };
                    feedback.querySelector("button").focus();
                };
            });
            body.querySelector(".pack-trial-question").focus({ preventScroll: true });
        }
        function renderResult() {
            const result = quiz.getResult();
            const body = header("お試し結果", "この結果は保存されません。気に入ったらパックを追加して学習できます。");
            body.innerHTML = `<h3>${result.total}問中 ${result.score}問正解</h3><p>正答率 ${result.accuracy}%</p>
                <div class="pack-preview-actions"><button class="primary" type="button" data-again>もう一度試す</button>
                <button class="menuButton" type="button" data-list>100語の一覧へ</button>
                <button class="menuButton" type="button" data-add>この${pack.words.length}語を追加する</button></div><p role="status" data-add-status></p>
                <h3>今回の問題</h3><ol class="pack-word-preview">${result.answers.map(answer => `<li>
                    <h4>${answer.correct ? '正解' : '不正解'} · ${escape(answer.word)} ${escape(answer.reading)}</h4>
                    <p>${escape(answer.meaning)}</p>${answer.description ? `<p>${escape(answer.description)}</p>` : ''}</li>`).join('')}</ol>`;
            body.querySelector("[data-again]").onclick = startTrial;
            body.querySelector("[data-list]").onclick = renderList;
            addButton(body);
        }
        if (trial) startTrial(); else renderList();
    }
    return { render };
})();
