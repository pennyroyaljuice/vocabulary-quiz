"use strict";

const Router = (() => {
    const routes = new Map();
    let currentRoute = null;

    function register(name, renderFunction) {
        if (typeof renderFunction !== "function") {
            throw new TypeError(
                `ルート「${name}」の描画関数が不正です。`
            );
        }

        routes.set(name, renderFunction);
    }

    function show(name, params = {}) {
        const renderFunction = routes.get(name);

        if (!renderFunction) {
            throw new Error(
                `ルート「${name}」は登録されていません。`
            );
        }

        const view = document.getElementById("view");

        if (!view) {
            throw new Error(
                "#view 要素が見つかりません。"
            );
        }

        currentRoute = {
            name,
            params
        };

        view.innerHTML = "";
        view.classList.remove("view");

        // アニメーションを再実行
        void view.offsetWidth;

        view.classList.add("view");

        renderFunction(view, params);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function refresh() {
        if (!currentRoute) {
            return;
        }

        show(
            currentRoute.name,
            currentRoute.params
        );
    }

    function getCurrentRoute() {
        return currentRoute
            ? { ...currentRoute }
            : null;
    }

    return {
        register,
        show,
        refresh,
        getCurrentRoute
    };
})();