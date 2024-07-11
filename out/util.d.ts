export declare const replacer: (key: any, value: any) => any;
export declare const reviver: (key: any, value: any) => any;
export declare const resolveToIP: (hostname: string) => Promise<string>;
export declare const compress: (data: Buffer, encoding?: string, quality?: number) => Buffer;
export declare const decompress: (data: Buffer, encoding?: string) => Buffer;
export declare const getRandomHex: (charCount: number) => string;
export declare const getRandomGuid: () => string;
