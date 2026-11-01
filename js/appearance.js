"use strict";

// Apply the saved design before the body is painted, then reuse on settings changes.
const Appearance = (() => {
    function apply(settings = {}) {
        const style = settings.uiStyle === "simple" ? "simple" : "pixel";
        document.documentElement.dataset.uiStyle = style;
        const stylesheet = document.getElementById("pixel-ui-stylesheet");
        if (stylesheet) stylesheet.media = style === "pixel" ? "all" : "not all";
    }

    try {
        const saved = JSON.parse(localStorage.getItem("vocabularyQuizV7") || "null");
        apply(saved?.settings || {});
    } catch {
        apply();
    }

    return { apply };
})();
