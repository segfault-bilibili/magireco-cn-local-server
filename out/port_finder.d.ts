export declare class portFinder {
    static test(port: number, host?: string): Promise<boolean>;
    static findAfter(port: number, host?: string): Promise<number>;
}
