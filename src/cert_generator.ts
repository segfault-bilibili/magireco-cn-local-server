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
        if (isCA) cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
        else cert.validity.notAfter.setTime(cert.validity.notBefore.getTime() + 90 * 24 * 60 * 60 * 1000);
        cert.validity.notBefore.setTime(cert.validity.notBefore.getTime() - 5 * 24 * 60 * 60 * 1000);
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
        }, {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        }, {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            emailProtection: true,
            timeStamping: true
        }, {
            name: 'nsCertType',
            client: true,
            server: true,
            email: true,
            objsign: true,
            sslCA: isCA,
            emailCA: isCA,
            objCA: isCA
        }];
        if (!isCA) {
            const dNSName = 2;
            const iPAddress = 7;
            let altNames = [{
                type: dNSName,
                value: commonName
            }];
            const ipType = net.isIP(commonName);
            if (ipType == 4 || ipType == 6) {
                let num: Array<number>;
                switch (ipType) {
                    case 4:
                        num = commonName.split(".").map((s) => parseInt(s));
                        break;
                    case 6:
                        let num16: Array<number>;
                        if (commonName.match(/::/)) {
                            let splitted = commonName.split("::");
                            if (splitted.length != 2) throw new Error("unexpected invalid IPv6 address (double-colon)");

                            let splittedAgain = splitted.map((str) => str.split(":").filter((s) => s.length > 0));

                            num16 = splittedAgain[0].map((s) => parseInt(`0x${s}`));

                            let paddingCount = 8 - num16.length - splittedAgain[1].length;
                            if (paddingCount < 0) throw new Error("unexpected invalid IPv6 address (paddingCount < 0)");
                            for (let i = 0; i < paddingCount; i++) num16.push(0);

                            splittedAgain[1].forEach((value) => num16.push(parseInt(`0x${value}`)));
                        } else {
                            num16 = commonName.split(":").map((s) => parseInt(`0x${s}`));
                        }
                        num = [];
                        num16.forEach((val) => {
                            num.push(val >> 8);
                            num.push(val & 0xFF);
                        });
                        break;
                }
                altNames.push({
                    type: iPAddress,
                    value: Buffer.from(new Uint8Array(num)).toString('ascii'),
                });
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