let consoleWidth = process.stdout.columns;
process.stdout.on('resize', () => { consoleWidth = process.stdout.columns; });
export const clampString = (s: string, max = 12) => s.length > max ? `...${s.substring(s.length - max - 3)}` : s;
export const clampToTTY = (s: string): string => {
    if (s.length <= consoleWidth) return s;
    if (consoleWidth <= 3) return "...".substring(0, consoleWidth);
    let left = Math.trunc((consoleWidth - 3) / 2);
    let right = consoleWidth - left - 3;
    return `${s.substring(0, left)}...${s.substring(s.length - right)}`;
}
export const logNoLF = (s: string): void => { process.stdout.write(`\r\x1b[K` + clampToTTY(s)); };