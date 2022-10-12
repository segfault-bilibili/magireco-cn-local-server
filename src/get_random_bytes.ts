import { randomBytes } from "crypto";

export const getRandomHex = (charCount: number): string => {
    return randomBytes(Math.trunc((charCount + 1) / 2)).toString('hex').substring(0, charCount);
}
