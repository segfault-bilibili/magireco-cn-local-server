"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logNoLF = exports.clampToTTY = exports.clampString = void 0;
let consoleWidth = process.stdout.columns;
process.stdout.on('resize', () => { consoleWidth = process.stdout.columns; });
const clampString = (s, max = 12) => s.length > max ? `...${s.substring(s.length - max - 3)}` : s;
exports.clampString = clampString;
const clampToTTY = (s) => {
    if (s.length <= consoleWidth)
        return s;
    if (consoleWidth <= 3)
        return "...".substring(0, consoleWidth);
    let left = Math.trunc((consoleWidth - 3) / 2);
    let right = consoleWidth - left - 3;
    return `${s.substring(0, left)}...${s.substring(s.length - right)}`;
};
exports.clampToTTY = clampToTTY;
const logNoLF = (s) => { process.stdout.write(`\r\x1b[K` + (0, exports.clampToTTY)(s)); };
exports.logNoLF = logNoLF;
