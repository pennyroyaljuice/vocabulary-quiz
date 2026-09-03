"use strict";

const Utils = {

    shuffle(array){

        const copy=[...array];

        for(let i=copy.length-1;i>0;i--){

            const j=Math.floor(Math.random()*(i+1));

            [copy[i],copy[j]]=[copy[j],copy[i]];

        }

        return copy;

    },

    randomInt(min,max){

        return Math.floor(

            Math.random()*(max-min+1)

        )+min;

    },

    sample(array,count){

        return Utils.shuffle(array).slice(0,count);

    },

    unique(array){

        return [...new Set(array)];

    },

    clamp(value,min,max){

        return Math.min(

            Math.max(value,min),

            max

        );

    },

    today(){

        return new Date().toISOString();

    },

    percentage(correct,total){

        if(total===0) return 0;

        return Math.round(

            correct/total*100

        );

    },

    isKatakana(word){

        return /^[ァ-ヶー・]+$/.test(word);

    },

    normalize(word){

        return word
            .replace(/（.*?）/g,"")
            .trim();

    },

    escapeHtml(value) {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    },

    escapeAttribute(value) {

        return Utils.escapeHtml(value)
            .replaceAll("`", "&#096;");

    }

};