"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStrRep = void 0;
// get string representation in javascript string
const getStrRep = (text) => Buffer.from(`${text}`, 'utf16le').swap16().toString('hex')
    .replace(/([\da-f]{4})/g, "\\u$1").replace(/\\u00/g, "\\x");
exports.getStrRep = getStrRep;
