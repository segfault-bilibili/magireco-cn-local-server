import * as forge from "node-forge";
export type certAndKey = {
    cert: string;
    key: string;
};
export declare class certGen {
    private CACertAndKey;
    private cachedCertAndKeys;
    constructor(CACertAndKey: certAndKey);
    getCertAndKey(servername: string): certAndKey;
    static newCertAndKey(isCA: boolean, servername?: string, keys?: forge.pki.KeyPair, CAPrivateKey?: forge.pki.PrivateKey): certAndKey;
}
