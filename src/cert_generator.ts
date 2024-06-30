import * as forge from "node-forge";
import * as crypto from "crypto";
import * as net from "net";

export type certAndKey = {
    cert: string,
    key: string,
}

export class certGen {
    private CACertAndKey: certAndKey;
    private cachedCertAndKeys = new Map<string, certAndKey>();
    constructor(CACertAndKey: certAndKey) {
        this.CACertAndKey = CACertAndKey;
    }
    getCertAndKey(servername: string): certAndKey {
        let cached = this.cachedCertAndKeys.get(servername);
        if (cached != null) return cached;

        while (this.cachedCertAndKeys.size > 1024) {
            let key = this.cachedCertAndKeys.entries().next().value[0];
            this.cachedCertAndKeys.delete(key);
        }

        let CAPrivateKey = forge.pki.privateKeyFromPem(this.CACertAndKey.key);
        let generated = certGen.newCertAndKey(false, servername, undefined, CAPrivateKey);
        this.cachedCertAndKeys.set(servername, generated);
        return generated;
    }
    static newCertAndKey(isCA: boolean, servername?: string,
        keys?: forge.pki.KeyPair, CAPrivateKey?: forge.pki.PrivateKey
    ): certAndKey {
        const CACommonName = "MagirecoLocalCA";
        let commonName = servername;
        if (isCA) {
            commonName = CACommonName;
        } else if (commonName == null) throw new Error("servername is required for leaf certificate");

        //if (keys == null) keys = forge.pki.ed25519.generateKeyPair(256); //
        if (keys == null) keys = forge.pki.rsa.generateKeyPair(2048);
        let cert = forge.pki.createCertificate();
        cert.publicKey = keys.publicKey;
        cert.serialNumber = crypto.randomBytes(32).toString("hex");
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        if (isCA) {
            cert.validity.notBefore.setFullYear(cert.validity.notBefore.getFullYear() - 1);
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 29);
        } else {
            cert.validity.notBefore.setTime(cert.validity.notBefore.getTime() - 5 * 24 * 60 * 60 * 1000);
            cert.validity.notAfter.setTime(cert.validity.notBefore.getTime() + 85 * 24 * 60 * 60 * 1000);
        }
        let attrs: Array<any> = [{
            name: 'commonName',
            value: commonName
        }, {
            name: 'countryName',
            value: 'CN'
        }, {
            shortName: 'ST',
            value: 'Shanghai'
        }, {
            name: 'localityName',
            value: 'Shanghai'
        }, {
            name: 'organizationName',
            value: 'MagirecoLocalCA'
        }, {
            shortName: 'OU',
            value: 'MagirecoLocalCA'
        }];
        cert.setSubject(attrs);
        let issuerAttrs = attrs.map((attr) => attr.name === 'commonName' ? { name: attr.name, value: CACommonName } : attr);
        cert.setIssuer(issuerAttrs);
        let exts: Array<any> = [{
            name: 'basicConstraints',
            cA: isCA
        }];
        if (!isCA) {
            const dNSName = 2;
            const iPAddress = 7;
            let altNames: Array<{ type: number, value: string } | { type: number, ip: string }> = [{
                type: dNSName,
                value: commonName
            }];
            const ipType = net.isIP(commonName);
            if (ipType == 4 || ipType == 6) {
                const browserDebugIP = "10.24.19.50";
                [commonName, browserDebugIP].forEach((ip) => altNames.push({
                    type: iPAddress,
                    ip: ip,
                }));
            }
            exts.push({
                name: 'subjectAltName',
                altNames: altNames
            });
        }
        cert.setExtensions(exts);
        if (isCA) CAPrivateKey = keys.privateKey; //self-sign
        else if (CAPrivateKey == null) throw new Error("CAPrivateKey is required to sign leaf certificate");
        cert.sign(CAPrivateKey, forge.md.sha256.create());

        console.log(`generated ${isCA ? "CA" : "leaf"} cert for [${commonName}]`);

        return {
            cert: forge.pki.certificateToPem(cert),
            key: forge.pki.privateKeyToPem(keys.privateKey),
        }
    }
}