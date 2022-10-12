"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomHex = void 0;
const crypto_1 = require("crypto");
const getRandomHex = (charCount) => {
    return (0, crypto_1.randomBytes)(Math.trunc((charCount + 1) / 2)).toString('hex').substring(0, charCount);
};
exports.getRandomHex = getRandomHex;
