"use strict";

const SharedVocabulary = (() => {
    const ENDPOINT = "https://vocabulary-sharing.pennyroyal-juice.workers.dev";
    const PUBLISHED_KEY = "vocabularyQuizPublishedSharesV1";
    const escape = value => Utils.escapeHtml(String(value ?? ""));
    const formatCode = code => code.match(/.{1,4}/g).join("-");
    let publishing = false;
    let refreshPublication = () => {};

    function publishedShares() {
        try {
            const value = JSON.parse(localStorage.getItem(PUBLISHED_KEY) || "[]");
            return Array.isArray(value) ? value.filter(item => /^\d{24}$/.test(item.code) && /^[a-f0-9]{64}$/.test(item.deleteToken)) : [];
        } catch { return []; }
    }
    async function request(path, options = {}) {
        let response;
        try {
            response = await fetch(ENDPOINT + path, { ...options, cache: "no-store", signal: AbortSignal.timeout(30000) });
        } catch {
            throw new Error("共有サーバーに接続できませんでした。通信状態を確認して再度お試しください。");
        }
        let result;
        try { result = await response.json(); } catch { throw new Error("共有サーバーの応答を読み取れませんでした。"); }
        if (!response.ok) throw new Error(result.error || `共有操作に失敗しました（${response.status}）。`);
        return result;
    }

    function render(container) {
        const words = Storage.getVocabulary().filter(word => typeof word.meaning === "string" && word.meaning.trim());
        container.innerHTML = `
            <section class="card">
                <div class="page-heading">
                    <div><p class="eyebrow">SHARE VOCABULARY</p><h2>語彙を共有</h2>
                    <p class="page-description">共有コードで、語彙セットを渡したり取り込んだりできます。</p></div>
                    <button class="menuButton compact-button" id="shareHome" type="button">設定へ戻る</button>
                </div>
            </section>
            <section class="card share-section">
                <h3>自分の語彙を公開する</h3>
                <p id="shareWordCount">意味が登録されている現在の${words.length}語をセットにします。読み・意味・補足・出典も共有します。</p>
                <p class="muted">コードを知っている人は取得できます。学習履歴・お気に入り・同期キーは含めません。公開後に自分の語彙を編集しても、共有済みの内容は変わりません。</p>
                <label for="shareName">セット名</label>
                <input id="shareName" class="share-input" maxlength="80" value="${escape(`共有語彙 ${new Date().toLocaleDateString('ja-JP')}`)}">
                <p class="muted">1セット最大2,000語・1MB。再度公開すると新しいコードが発行されます。</p>
                <button id="publishShare" class="primary" type="button" ${!words.length || publishing ? 'disabled' : ''}>現在の${words.length}語を公開する</button>
                <div id="publishResult" aria-live="polite"></div>
            </section>
            <section class="card share-section">
                <h3>共有コードから取り込む</h3>
                <form id="lookupShare"><label for="shareCode">共有コード（24桁）</label>
                    <input id="shareCode" class="share-input share-code" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="0000-0000-0000-0000-0000-0000" maxlength="48" required>
                    <button class="primary" type="submit">内容を確認する</button>
                </form>
                <div id="sharePreview" aria-live="polite"></div>
            </section>
            <section class="card share-section"><h3>取り込んだ共有セット</h3>
                <p class="muted">このセットから追加した語と、その語の学習記録をまとめて削除できます。取り込む前からあった語や、重複して追加しなかった語は残ります。</p>
                <div id="importedShares"></div>
            </section>
            <section class="card share-section"><h3>このブラウザーで公開したセット</h3>
                <p class="muted">公開停止はこのブラウザーから行えます。すでに他の人が取り込んだ語彙は消えません。ブラウザーの保存データを消すと公開停止の情報も失われます。</p>
                <div id="publishedShares"></div>
            </section>`;
        container.querySelector("#shareHome").onclick = () => Router.show("settings");
        const publishedList = container.querySelector("#publishedShares");
        const importedList = container.querySelector("#importedShares");

        function updatePublishCount() {
            if (!container.querySelector("#shareWordCount")) return;
            const count = Storage.getVocabulary().filter(word => typeof word.meaning === "string" && word.meaning.trim()).length;
            container.querySelector("#shareWordCount").textContent = `意味が登録されている現在の${count}語をセットにします。読み・意味・補足・出典も共有します。`;
            const button = container.querySelector("#publishShare");
            button.textContent = `現在の${count}語を公開する`;
            button.disabled = !count || publishing;
        }

        function showImports() {
            updatePublishCount();
            importedList.replaceChildren();
            const packs = Storage.getSharedVocabularyPacks();
            if (!packs.length) { importedList.textContent = "まだ取り込んだ共有セットはありません。"; return; }
            for (const pack of packs) {
                const item = document.createElement("article");
                item.className = "share-item";
                item.innerHTML = `<h4>${escape(pack.name)}</h4><p>${pack.count}語 · <span class="share-code">${formatCode(pack.code)}</span></p>
                    <button class="menuButton" type="button">このセットの語彙を削除</button><p class="share-message" aria-live="polite"></p>`;
                item.querySelector("button").onclick = async () => {
                    if (!confirm(`「${pack.name}」から追加した${pack.count}語と、その語の学習記録を削除します。取り込み後に編集した語も含みます。続けますか？`)) return;
                    try {
                        const result = Storage.removeSharedVocabulary(pack.code);
                        await App.reloadWords();
                        showImports();
                        const message = document.createElement("p");
                        message.setAttribute("role", "status");
                        message.textContent = `${result.removedCount}語を削除しました。`;
                        importedList.prepend(message);
                    } catch (error) { item.querySelector(".share-message").textContent = error.message; }
                };
                importedList.append(item);
            }
        }
        function showPublished() {
            publishedList.replaceChildren();
            const shares = publishedShares();
            if (!shares.length) { publishedList.textContent = "このブラウザーで公開したセットはありません。"; return; }
            for (const pack of [...shares].reverse()) {
                const item = document.createElement("article");
                item.className = "share-item";
                item.innerHTML = `<h4>${escape(pack.name)}</h4><p>${Number(pack.count) || 0}語 · ${escape(new Date(pack.createdAt).toLocaleDateString('ja-JP'))}</p>
                    <p class="share-code">${formatCode(pack.code)}</p><div class="share-actions">
                    <button class="menuButton" data-copy type="button">コードをコピー</button>
                    <button class="menuButton" data-revoke type="button">公開を停止</button></div><p class="share-message" aria-live="polite"></p>`;
                item.querySelector("[data-copy]").onclick = async () => {
                    try { await navigator.clipboard.writeText(formatCode(pack.code)); item.querySelector(".share-message").textContent = "コードをコピーしました。"; }
                    catch { item.querySelector(".share-message").textContent = "コードを選択してコピーしてください。"; }
                };
                item.querySelector("[data-revoke]").onclick = async event => {
                    if (!confirm(`「${pack.name}」の公開を停止します。今後このコードでは取得できなくなります。続けますか？`)) return;
                    event.target.disabled = true;
                    try {
                        await request(`/shares/${pack.code}`, { method: "DELETE", headers: { "X-Delete-Token": pack.deleteToken } });
                        localStorage.setItem(PUBLISHED_KEY, JSON.stringify(publishedShares().filter(entry => entry.code !== pack.code)));
                        showPublished();
                    } catch (error) { item.querySelector(".share-message").textContent = error.message; event.target.disabled = false; }
                };
                publishedList.append(item);
            }
        }
        container.querySelector("#publishShare").onclick = async event => {
            const button = event.target;
            const output = container.querySelector("#publishResult");
            button.disabled = true;
            publishing = true;
            output.textContent = "公開しています…";
            try {
                // 公開直前の内容を使い、閲覧後の編集も取り込む。
                const pack = VocabularyShareFormat.normalizePack({ name: container.querySelector("#shareName").value,
                    words: Storage.getVocabulary().filter(word => typeof word.meaning === "string" && word.meaning.trim()) });
                localStorage.setItem(PUBLISHED_KEY, JSON.stringify(publishedShares()));
                const result = await request("/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pack) });
                const code = VocabularyShareFormat.normalizeCode(result.code);
                output.textContent = `公開しました。共有コード：${formatCode(code)}`;
                try {
                    localStorage.setItem(PUBLISHED_KEY, JSON.stringify([...publishedShares(), result]));
                    showPublished();
                } catch { output.textContent += "（公開履歴を保存できませんでした。このコードを控えてください。）"; }
            } catch (error) { output.textContent = error.message; }
            finally { publishing = false; refreshPublication(); }
        };
        let lookupSerial = 0;
        container.querySelector("#lookupShare").onsubmit = async event => {
            event.preventDefault();
            const serial = ++lookupSerial;
            const preview = container.querySelector("#sharePreview");
            preview.textContent = "確認しています…";
            try {
                const code = VocabularyShareFormat.normalizeCode(container.querySelector("#shareCode").value);
                const response = await request(`/shares/${code}`);
                if (serial !== lookupSerial) return;
                const pack = { ...VocabularyShareFormat.normalizePack(response), code };
                const existing = new Set([...Storage.getVocabulary(), ...Storage.getPendingWords()].map(word => Storage.normalizeWordKey(word.word)));
                const added = pack.words.filter(word => !existing.has(Storage.normalizeWordKey(word.word))).length;
                preview.innerHTML = `<h4>${escape(pack.name)}</h4><p>全${pack.words.length}語 · 新しく追加：${added}語 · 重複：${pack.words.length - added}語</p>
                    <details><summary>語彙の内容を確認（${pack.words.length}語）</summary><ul class="share-preview-list">${pack.words.map(word => `<li><strong>${escape(word.word)}</strong> ${escape(word.reading)}<p>${escape(word.meaning)}</p></li>`).join("")}</ul></details>
                    <p class="muted">同じ語は上書きしません。新しく追加した分は、あとでこのセット単位で削除できます。</p>
                    <button class="primary" type="button" ${added ? '' : 'disabled'}>このセットを取り込む</button><p class="share-message" aria-live="polite"></p>`;
                preview.querySelector("button").onclick = async event => {
                    event.target.disabled = true;
                    try {
                        const result = Storage.addSharedVocabulary(pack);
                        await App.reloadWords();
                        preview.querySelector(".share-message").textContent = `${result.addedCount}語を追加しました。重複${result.skippedCount}語は追加していません。`;
                        showImports();
                    } catch (error) { preview.querySelector(".share-message").textContent = error.message; event.target.disabled = false; }
                };
            } catch (error) { if (serial === lookupSerial) preview.textContent = error.message; }
        };
        showImports();
        showPublished();
        refreshPublication = () => {
            if (container.querySelector("#publishedShares") !== publishedList) return;
            showPublished();
            updatePublishCount();
        };
    }
    return { render };
})();
