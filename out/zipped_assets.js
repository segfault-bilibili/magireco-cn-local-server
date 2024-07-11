"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.zippedAssets = void 0;
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const fsPromises = require("fs/promises");
const stream = require("stream");
const cn_legacy_asset_json_list_1 = require("./cn_legacy_asset_json_list");
const toInt = (s) => {
    let buf = new Uint8Array(Buffer.from(s, 'ascii'));
    let dv = new DataView(buf.slice().buffer);
    return dv.getUint32(0, true);
};
const clampString = (s, max = 16) => s.length > max ? `...${s.substring(s.length - max - 3)}` : s;
class zippedAssets {
    constructor(assetToZipMap, fileHandleMap) {
        this.assetToZipMap = assetToZipMap;
        this.fileHandleMap = fileHandleMap;
        console.log(`zippedAssets: initialized, registered ${this.assetToZipMap.size} entries stored in ${this.fileHandleMap.size} zip archives`);
    }
    static async init() {
        // 1. if ./static_zip/ does not exist, try convert legacy ./static/
        // 2. scan ./static_zip/ to register zip files
        // 3. parse each zip file to create the map: requested path => zip
        console.log(`zippedAssets: init...`);
        const assetToZipMap = new Map();
        const fileHandleMap = new Map();
        let zipFiles;
        try {
            zipFiles = (await fsPromises.readdir(this.cnOffcialZippedAssetsDir)).filter((fileName) => fileName.endsWith('.zip'));
        }
        catch (e) {
            console.error(`zippedAssets: cannot open directory [${this.cnOffcialZippedAssetsDir}]`, e);
            await fsPromises.mkdir(this.cnOffcialZippedAssetsDir);
            zipFiles = [];
        }
        if (zipFiles.length == 0) {
            return await this.convertCNLegacy();
        }
        let zipCount = 0;
        for (let zipFileName of zipFiles) {
            try {
                let zipFilePath = path.join(this.cnOffcialZippedAssetsDir, zipFileName);
                let handle = await fsPromises.open(zipFilePath, "r");
                fileHandleMap.set(zipFileName, handle);
                let startTime = Date.now();
                let tempMap = await this.parseZip(zipFileName, handle);
                let lastEntryCount = assetToZipMap.size;
                for (let entry of tempMap) {
                    let zipEntryName = entry[0];
                    let positionInZip = entry[1];
                    assetToZipMap.set(zipEntryName, positionInZip);
                }
                let increased = assetToZipMap.size - lastEntryCount;
                let duplicate = tempMap.size - increased;
                zipCount++;
                console.log(`zippedAssets: registered [${zipFileName}]: `
                    + `added ${increased}${duplicate > 0 ? `, replaced ${duplicate}` : ""} file entries (${Date.now() - startTime}ms)`);
            }
            catch (e) {
                console.error(`zippedAssets: error parsing [${zipFileName}], skipped this zip`, e);
            }
        }
        return new _a(assetToZipMap, fileHandleMap);
    }
    static async convertCNLegacy() {
        console.log(`zippedAssets: converting CN legacy ./static/ ...`);
        const assetToZipMap = new Map();
        const fileHandleMap = new Map();
        const compressMethod = 0;
        // (1) downloaded assets
        for (let name of this.assetJsonNames) {
            console.log(`zippedAssets: converting legacy CN static resource [${name}]...`);
            let jsonPath = path.join(this.CNLegacyAssetJsonDir, `zip_asset_${name}.json`);
            let assetJSON = JSON.parse(await fsPromises.readFile(jsonPath, 'utf-8'));
            let joinedZipFileName = `cn_official_asset_${name}_joined.zip`;
            let outPath = path.join(this.cnOffcialZippedAssetsDir, joinedZipFileName);
            let outHandle = await fsPromises.open(outPath, "w+");
            let entryNameSet = new Set();
            let CDFHBufs = [];
            let offset = 0;
            for (let item of assetJSON) {
                if (item.file_list.length != 1)
                    throw new Error(`item.file_list.length != 1`);
                let zipFilePath = `${this.CNLegacyPathPrefix}/${item.file_list[0].url}`;
                let inHandle = await fsPromises.open(path.join(this.CNLegacyRootDir, zipFilePath), "r");
                let zipFileSize = (await inHandle.stat()).size;
                let crc32 = await this.crc32(inHandle);
                let CDFHList = [];
                let zipParsedMap = await this.parseZip(zipFilePath, inHandle, CDFHList);
                let fileHeader = await this.readFileHeader(inHandle, CDFHList[0].FHOffset);
                fileHeader = this.modifyFileHeader(fileHeader, zipFilePath, zipFileSize, crc32);
                await outHandle.write(fileHeader);
                let headerBeforeNestedZip = offset;
                offset += fileHeader.byteLength;
                let nestedZipFileStart = offset;
                let CDFHBufOfSelf = this.modifyCDFH(entryNameSet, CDFHList[0].buf, headerBeforeNestedZip, zipFilePath, zipFileSize, crc32);
                CDFHList.forEach((CDFH) => {
                    let buf = this.modifyCDFH(entryNameSet, CDFH.buf, nestedZipFileStart);
                    CDFHBufs.push(buf);
                });
                CDFHBufs.push(CDFHBufOfSelf);
                let inStream = inHandle.createReadStream({ start: 0, autoClose: true, emitClose: true, highWaterMark: this.chunkSize });
                let outStream = new stream.Writable({
                    write: (chunk, encoding, callback) => { outHandle.write(chunk).then(() => { callback(); }); },
                    writev: (chunks, callback) => { outHandle.writev(chunks.map(c => c.chunk)).then(() => { callback(); }); },
                    highWaterMark: this.chunkSize,
                });
                await new Promise((resolve, reject) => {
                    inStream.on('close', () => { resolve(); });
                    stream.pipeline(inStream, outStream, (err) => { reject(err); });
                });
                offset += zipFileSize;
                process.stdout.write(`\r\x1b[K` + `zippedAssets: [${clampString(joinedZipFileName)}]: written [${clampString(zipFilePath)}]`);
                assetToZipMap.set(zipFilePath, [joinedZipFileName, compressMethod, headerBeforeNestedZip, zipFileSize, crc32]);
                zipParsedMap.forEach((positionInZip, zipEntryName) => {
                    positionInZip[0] = joinedZipFileName;
                    positionInZip[2] += nestedZipFileStart;
                    assetToZipMap.set(zipEntryName, positionInZip);
                });
            }
            process.stdout.write("\n");
            let newEOCD = this.newEOCD(CDFHBufs.length, CDFHBufs.reduce((prev, cur) => prev + cur.byteLength, 0), offset);
            await outHandle.writev(CDFHBufs);
            await outHandle.write(newEOCD);
            await outHandle.close();
            let newHandle = await fsPromises.open(outPath, "r");
            fileHandleMap.set(joinedZipFileName, newHandle);
            console.log(`zippedAssets: packed ${entryNameSet.size} files into [${joinedZipFileName}], ${assetToZipMap.size} packed files in total`);
        }
        // web resources
        console.log(`zippedAssets: converting web resources...`);
        const replacementJsPath = path.join(this.CNLegacyRootDir, "magica/js/system/replacement.js");
        const webResFileList = Object.keys(JSON.parse((await fsPromises.readFile(replacementJsPath, 'utf-8')).replace("window.fileTimeStamp=", "")));
        cn_legacy_asset_json_list_1.cnLegacyAssetJsonList.forEach((json) => webResFileList.push(`${this.CNLegacyPathPrefix.replace(/^magica\//, "")}/${this.CNLegacyAssetVer}/${json}`));
        webResFileList.push("js/system/replacement.js");
        webResFileList.push("js/_common/baseConfig.js");
        webResFileList.push("index.html");
        let CDFHBufs = [];
        const webResJoinedZipFileName = "cn_official_web_res.zip";
        const webResJoinedZipPath = path.join(this.cnOffcialZippedAssetsDir, webResJoinedZipFileName);
        let outHandle = await fsPromises.open(webResJoinedZipPath, "w+");
        let offset = 0;
        let skippedCount = 0;
        for (let webResFileName of webResFileList) {
            let pathInUrl = `magica/${webResFileName}`.split("/").map((s) => encodeURIComponent(s)).join("/");
            if (this.CNLegacy404Set.has(`/${pathInUrl}`)) {
                skippedCount++;
                continue;
            }
            let webResFilePath = path.join(this.CNLegacyRootDir, pathInUrl);
            let inHandle = await fsPromises.open(webResFilePath, "r");
            let inflatedSize = (await inHandle.stat()).size;
            let inflated = new Uint8Array(inflatedSize);
            await inHandle.read(inflated, 0, inflatedSize, 0);
            let crc32 = await this.crc32(inHandle);
            inHandle.close();
            let compressMethod = 8;
            let deflated = zlib.deflateRawSync(inflated, { level: 9 });
            deflated = new Uint8Array(deflated.buffer, deflated.byteOffset, deflated.byteLength);
            let deflatedSize = deflated.byteLength;
            if (deflatedSize >= inflatedSize) {
                compressMethod = 0;
                deflated = inflated;
                deflatedSize = inflatedSize;
            }
            let fileHeader = this.newFileHeader(pathInUrl, compressMethod, deflatedSize, inflatedSize, crc32);
            await outHandle.write(fileHeader);
            let headerBeforeDeflated = offset;
            offset += fileHeader.byteLength;
            let deflatedStart = offset;
            await outHandle.write(deflated);
            offset += deflated.byteLength;
            process.stdout.write(`\r\x1b[K` + `zippedAssets: [${clampString(webResJoinedZipFileName)}]: written [${clampString(pathInUrl)}]`);
            CDFHBufs.push(this.newCDFH(pathInUrl, headerBeforeDeflated, compressMethod, deflatedSize, inflatedSize, crc32));
            if (assetToZipMap.has(pathInUrl))
                throw new Error(`conflicting pathInUrl = [${pathInUrl}]`);
            assetToZipMap.set(pathInUrl, [webResJoinedZipFileName, compressMethod, deflatedStart, deflatedSize, crc32]);
        }
        process.stdout.write("\n");
        let newEOCD = this.newEOCD(CDFHBufs.length, CDFHBufs.reduce((prev, cur) => prev + cur.byteLength, 0), offset);
        await outHandle.writev(CDFHBufs);
        await outHandle.write(newEOCD);
        await outHandle.close();
        let newHandle = await fsPromises.open(webResJoinedZipPath, "r");
        fileHandleMap.set(webResJoinedZipFileName, newHandle);
        console.log(`zippedAssets: packed ${webResFileList.length - skippedCount} files into [${webResJoinedZipFileName}], ${assetToZipMap.size} packed files in total`);
        console.log(`zippedAssets: packed ${assetToZipMap.size} files into ${fileHandleMap.size} zip archives in total`);
        return new _a(assetToZipMap, fileHandleMap);
    }
    async checkIntegrity(subDirectory = "cn_official") {
        console.log(`zippedAssets: checkIntegrity for ${subDirectory}...`);
        let checkResult = true;
        const md5Map = new Map();
        const okaySet = new Set();
        const missingSet = new Set();
        const md5MismatchSet = new Set();
        const crc32MismatchSet = new Set();
        // check md5 according to official asset list jsons
        const prefix = `/${_a.CNLegacyPathPrefix}/${_a.CNLegacyAssetVer}/`;
        const assetJsonFileNames = [];
        _a.assetJsonNames.forEach((name) => {
            name = `asset_${name}.json`;
            assetJsonFileNames.push(name);
            name = `zip_${name}`;
            assetJsonFileNames.push(name);
        });
        for (let fileName of assetJsonFileNames) {
            let pathInUrl = `${prefix}${fileName}`;
            let data = await this.readFileAsync(pathInUrl);
            if (data == null)
                throw new Error(`cannot read asset list json`);
            let assetList = JSON.parse(data.toString('utf-8'));
            for (let entry of assetList) {
                if (entry.file_list.length != 1)
                    throw new Error(`entry.file_list.length != 1`);
                let pathInUrl = `/${_a.CNLegacyPathPrefix}/${entry.file_list[0].url}`;
                let md5 = entry.md5;
                md5Map.set(pathInUrl, md5);
            }
        }
        for (let entry of md5Map) {
            let pathInUrl = entry[0];
            let expected = entry[1];
            let data = await this.readFileAsync(pathInUrl);
            if (data == null) {
                missingSet.add(pathInUrl);
                checkResult = false;
                process.stdout.write(`\r\x1b[K` + `zippedAssets: md5: [MISSING] [${clampString(pathInUrl)}]` + `\n`);
                continue;
            }
            let md5 = crypto.createHash("md5").update(data).digest().toString('hex').toLowerCase();
            let okay = md5 === expected;
            if (!okay) {
                md5MismatchSet.add(pathInUrl);
                checkResult = false;
            }
            else {
                okaySet.add(pathInUrl);
            }
            process.stdout.write(`\r\x1b[K` + `zippedAssets: md5: [${okay ? "OK" : "FAIL"}] [${clampString(pathInUrl)}]` + `${okay ? "" : "\n"}`);
        }
        process.stdout.write("\n");
        // convert okaySet to pathInZip
        const okaySetInZip = new Set();
        for (let pathInUrl of okaySet) {
            let pathInZip = this.getPathInZip(pathInUrl);
            if (pathInZip == null)
                throw new Error(`pathInZip == null`); // should never happen because this.readFileAsync() calls getPathInZip as well
            okaySetInZip.add(pathInZip);
        }
        ;
        // check crc32
        for (let pathInZip of this.assetToZipMap.keys()) {
            if (okaySetInZip.has(pathInZip))
                continue;
            let data = await this.readFileAsync(pathInZip, true);
            let okay = data != null;
            if (!okay) {
                crc32MismatchSet.add(pathInZip);
                checkResult = false;
            }
            else {
                okaySetInZip.add(pathInZip);
            }
            process.stdout.write(`\r\x1b[K` + `zippedAssets: crc32: [${okay ? "OK" : "FAIL"}] [${clampString(pathInZip)}]` + `${okay ? "" : "\n"}`);
        }
        process.stdout.write("\n");
        console.log(`zippedAssets: checkIntegrity ${checkResult ? "OK" : "FAIL"}`);
        console.log(`zippedAssets: ${okaySetInZip.size} ok, ${missingSet.size} missing, ${md5MismatchSet.size} md5 mismatch ${crc32MismatchSet.size} crc32 mismatch`);
        return checkResult;
    }
    static crc32(data) {
        return new Promise((resolve, reject) => {
            let inStream;
            try {
                if (data instanceof Uint8Array) {
                    inStream = new stream.PassThrough().end(data);
                }
                else {
                    inStream = data.createReadStream({ start: 0, autoClose: false, highWaterMark: this.chunkSize });
                }
            }
            catch (e) {
                reject(e);
                return;
            }
            let gzip = zlib.createGzip({ level: 0, chunkSize: this.chunkSize });
            let lastChunk;
            let outStream = new stream.Writable({
                write: (chunk, encoding, callback) => { lastChunk = chunk; callback(); },
                writev: (chunks, callback) => { lastChunk = chunks[chunks.length - 1].chunk; callback(); },
                highWaterMark: this.chunkSize,
            });
            outStream.on('close', () => {
                let dv = new DataView(lastChunk.buffer, lastChunk.byteOffset, lastChunk.byteLength);
                let crc32 = dv.getUint32(dv.byteLength - 8, true);
                resolve(crc32);
            });
            stream.pipeline(inStream, gzip, outStream, (err) => { reject(err); });
        });
    }
    static async parseZip(zipFileName, handle, outCDFHList) {
        const tempMap = new Map();
        const { CDOffset, CDSize } = await this.findEOCD(handle);
        let CDBuf = new Uint8Array(CDSize);
        await handle.read(CDBuf, 0, CDSize, CDOffset);
        if (outCDFHList == null)
            outCDFHList = [];
        while (CDBuf.byteLength > 0) {
            CDBuf = this.parseCDFH(CDBuf, outCDFHList);
        }
        for (let CDFH of outCDFHList) {
            let FHOffset = CDFH.FHOffset;
            let FHBuf = new Uint8Array(30);
            await handle.read(FHBuf, 0, FHBuf.byteLength, FHOffset);
            let dv = new DataView(FHBuf.buffer, FHBuf.byteOffset, FHBuf.byteLength);
            let signature = dv.getUint32(0, true);
            if (signature != this.FHSigature)
                throw new Error(`file header signature mismatch`);
            let compressMethod = dv.getUint16(8, true);
            let crc32 = dv.getUint32(14, true);
            let compressedSize = dv.getUint32(18, true);
            let fileNameLen = dv.getUint16(26, true);
            let extraFieldLen = dv.getUint16(28, true);
            let dataOffset = FHOffset + 30 + fileNameLen + extraFieldLen;
            let dataEnd = dataOffset + compressedSize;
            if (dataEnd > CDOffset)
                throw new Error(`[${zipFileName} / ${CDFH.fileName}] end of compressed data exceeds begin of central directory`);
            tempMap.set(CDFH.fileName, [zipFileName, compressMethod, dataOffset, compressedSize, crc32]);
        }
        return tempMap;
    }
    static async readFileHeader(handle, offset) {
        let buf = new Uint8Array(30);
        await handle.read(buf, 0, buf.byteLength, offset);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.FHSigature)
            throw new Error(`file header signature mismatch`);
        let fileNameLen = dv.getUint16(26, true);
        let extraFieldLen = dv.getUint16(28, true);
        let len = 30 + fileNameLen + extraFieldLen;
        let newBuf = new Uint8Array(len);
        newBuf.set(buf);
        buf = newBuf;
        await handle.read(buf, 30, len - 30, offset + 30);
        return buf;
    }
    static newFileHeader(entryName, compressMethod, deflatedSize, inflatedSize, crc32) {
        let newRawFileName = Buffer.from(entryName, 'ascii');
        let newFileNameLen = newRawFileName.byteLength;
        let buf = new Uint8Array(30 + newFileNameLen);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        dv.setUint32(0, this.FHSigature, true);
        let minVersion = 20;
        dv.setUint16(4, minVersion, true);
        dv.setUint16(8, compressMethod, true);
        let lastModTime = 0x773B;
        dv.setUint16(10, lastModTime, true);
        let lastModDate = 0x5173;
        dv.setUint16(12, lastModDate, true);
        dv.setUint32(14, crc32, true);
        dv.setUint32(18, deflatedSize, true);
        dv.setUint32(22, inflatedSize, true);
        dv.setUint16(26, newFileNameLen, true);
        buf.set(newRawFileName, 30);
        return buf;
    }
    static modifyFileHeader(buf, entryName, newDataSize, crc32) {
        let newRawFileName = Buffer.from(entryName, 'ascii');
        let newFileNameLen = newRawFileName.byteLength;
        let oldBuf = buf;
        buf = new Uint8Array(30 + newFileNameLen);
        buf.set(oldBuf.subarray(0, 30), 0);
        buf.set(newRawFileName, 30);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.FHSigature)
            throw new Error(`file header signature mismatch`);
        let compressMethod = 0;
        dv.setUint16(8, compressMethod, true);
        dv.setUint32(14, crc32, true);
        dv.setUint32(18, newDataSize, true);
        dv.setUint32(22, newDataSize, true);
        dv.setUint16(26, newFileNameLen, true);
        let newExtraFieldLen = 0;
        dv.setUint16(28, newExtraFieldLen, true);
        return buf;
    }
    static parseCDFH(buf, outCDFHList) {
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.CDFHSigature)
            throw new Error(`CDFH signature mismatch`);
        let fileNameLen = dv.getUint16(28, true);
        let extraFieldLen = dv.getUint16(30, true);
        let commentLen = dv.getUint16(32, true);
        let fileName = Buffer.from(buf.subarray(46, 46 + fileNameLen)).toString('ascii');
        let FHOffset = dv.getUint32(42, true);
        let len = 46 + fileNameLen + extraFieldLen + commentLen;
        if (len > buf.byteLength)
            throw new Error(`unexpected EOF`);
        let CDFH = new Uint8Array(buf.buffer, buf.byteOffset, len);
        let remaining = new Uint8Array(buf.buffer, buf.byteOffset + len);
        outCDFHList.push({
            fileName: fileName,
            FHOffset: FHOffset,
            buf: CDFH,
        });
        return remaining;
    }
    static newCDFH(entryName, FHOffset, compressMethod, deflatedSize, inflatedSize, crc32) {
        let newRawFileName = Buffer.from(entryName, 'ascii');
        let newFileNameLen = newRawFileName.byteLength;
        let buf = new Uint8Array(46 + newFileNameLen);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        dv.setUint32(0, this.CDFHSigature, true);
        let versionMadeBy = 788;
        dv.setUint16(4, versionMadeBy, true);
        let minVersion = 20;
        dv.setUint16(6, minVersion, true);
        dv.setUint16(10, compressMethod, true);
        let lastModTime = 0x773B;
        dv.setUint16(12, lastModTime, true);
        let lastModDate = 0x5173;
        dv.setUint16(14, lastModDate, true);
        dv.setUint32(16, crc32, true);
        dv.setUint32(20, deflatedSize, true);
        dv.setUint32(24, inflatedSize, true);
        dv.setUint16(28, newFileNameLen, true);
        let externalAttributes = 0x81A40000;
        dv.setUint32(38, externalAttributes, true);
        dv.setUint32(42, FHOffset, true);
        buf.set(newRawFileName, 46);
        return buf;
    }
    static modifyCDFH(entryNameSet, buf, offset, entryName, newDataSize, crc32) {
        let newRawFileName;
        let newFileNameLen;
        if (entryName != null) {
            newRawFileName = Buffer.from(entryName, 'ascii');
            newFileNameLen = newRawFileName.byteLength;
        }
        else {
            let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
            newFileNameLen = dv.getUint16(28, true);
            newRawFileName = buf.subarray(46, 46 + newFileNameLen);
            entryName = Buffer.from(newRawFileName).toString('ascii');
        }
        if (entryNameSet.has(entryName))
            throw new Error(`conflicting entryName ${entryName}`);
        else
            entryNameSet.add(entryName);
        if (entryName.length != newRawFileName.byteLength)
            throw new Error(`${entryName} string length != raw length`);
        if (newRawFileName.length == 0)
            throw new Error(`${entryName} raw length == 0`);
        let oldBuf = buf;
        buf = new Uint8Array(46 + newFileNameLen);
        buf.set(oldBuf.subarray(0, 46), 0);
        buf.set(newRawFileName, 46);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.CDFHSigature)
            throw new Error(`CDFH signature mismatch`);
        if (newDataSize != null && crc32 != null) {
            let compressMethod = 0;
            dv.setUint16(10, compressMethod, true);
            dv.setUint32(16, crc32, true);
            dv.setUint32(20, newDataSize, true);
            dv.setUint32(24, newDataSize, true);
        }
        dv.setUint16(28, newFileNameLen, true);
        let extraFieldLen = 0;
        dv.setUint16(30, extraFieldLen, true);
        let commentLen = 0;
        dv.setUint16(32, commentLen, true);
        offset += dv.getUint32(42, true);
        dv.setUint32(42, offset, true);
        return buf;
    }
    static async findEOCD(handle, outEOCD) {
        const EOCDMin = 22;
        const EOCDMax = EOCDMin + 0xFFFF;
        const stat = await handle.stat();
        const fileSize = stat.size;
        const buf = new Uint8Array(Math.min(fileSize, EOCDMax));
        const dv = new DataView(buf.buffer);
        await handle.read(buf, 0, buf.byteLength, fileSize - buf.byteLength);
        for (let offset = dv.byteLength - EOCDMin; offset >= 0; offset--) {
            let signature = dv.getUint32(offset, true);
            if (signature != this.EOCDSigature)
                continue;
            let commentLen = dv.getUint16(offset + 20, true);
            if (offset + EOCDMin + commentLen != dv.byteLength)
                continue;
            let CDSize = dv.getUint32(offset + 12, true);
            let CDOffset = dv.getUint32(offset + 16, true);
            if (outEOCD != null) {
                outEOCD.push(buf.slice(offset));
            }
            return {
                CDOffset: CDOffset,
                CDSize: CDSize,
            };
        }
        throw new Error(`invalid zip: end of central directory not found`);
    }
    static newEOCD(CDFHCount, CDSize, CDOffset) {
        let buf = new Uint8Array(22);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        dv.setUint32(0, this.EOCDSigature, true);
        dv.setUint16(8, CDFHCount, true);
        dv.setUint16(10, CDFHCount, true);
        dv.setUint32(12, CDSize, true);
        dv.setUint32(16, CDOffset, true);
        return buf;
    }
    getPathInZip(pathInUrl) {
        // (1) lookup directly (web_res.zip)
        let pathInZip = pathInUrl.replace(/^\//, "");
        if (this.assetToZipMap.has(pathInZip))
            return pathInZip;
        // (2) cn joined zips use stripped paths
        pathInZip = pathInZip.replace(/^magica\/resource\/(download\/asset\/master\/resource\/\d+\/|)/, "");
        if (this.assetToZipMap.has(pathInZip))
            return pathInZip;
        console.error(`zippedAssets: cannot find [${pathInZip}] in any zip file (pathInUrl=[${pathInUrl}])`);
    }
    async readFileAsync(pathInUrl, crc32) {
        const pathInZip = this.getPathInZip(pathInUrl);
        if (pathInZip == null)
            return;
        let val = this.assetToZipMap.get(pathInZip);
        if (val == null)
            return;
        const zipFileName = val[0];
        const method = val[1];
        const dataOffset = val[2];
        const compressedSize = val[3];
        if (typeof crc32 === 'boolean')
            crc32 = crc32 ? val[4] : undefined;
        let data;
        for (let retries = 3; retries > 0 && data == null; retries--) {
            try {
                data = await this.extract(zipFileName, method, dataOffset, compressedSize, crc32);
            }
            catch (e) {
                console.error(`zippedAssets: error extracting [${pathInZip}] from [${zipFileName}], retrying...`, e);
                this.fileHandleMap.delete(zipFileName);
            }
        }
        if (data == null) {
            console.error(`zippedAssets: cannot extract [${pathInUrl}]`);
            return;
        }
        return Buffer.from(data);
    }
    static getContentType(pathInUrl) {
        let contentTypeMap;
        let matched = pathInUrl.match(this.fileExtRegEx);
        if (matched)
            contentTypeMap = this.contentTypeMap.get(matched[0]);
        if (contentTypeMap != null)
            return contentTypeMap;
        else
            return this.defMimeType;
    }
    async extract(zipFileName, method, dataOffset, compressedSize, crc32) {
        let handle = this.fileHandleMap.get(zipFileName);
        if (handle == null) {
            const zipFilePath = path.join(_a.cnOffcialZippedAssetsDir, zipFileName);
            handle = await fsPromises.open(zipFilePath, "r");
            this.fileHandleMap.set(zipFileName, handle);
        }
        let buf = new Uint8Array(compressedSize);
        await handle.read(buf, 0, compressedSize, dataOffset);
        if (method == 8) {
            let inflated = zlib.inflateRawSync(buf);
            buf = new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength); // TODO make this streamed
        }
        if (crc32 != null) {
            let calculated = await _a.crc32(buf);
            if (crc32 != calculated)
                return;
        }
        return buf;
    }
}
exports.zippedAssets = zippedAssets;
_a = zippedAssets;
zippedAssets.assetJsonNames = [
    "main",
    "voice",
    "fullvoice",
    "movie_high",
    "movie_low",
];
zippedAssets.FHSigature = toInt("PK\x03\x04");
zippedAssets.CDFHSigature = toInt("PK\x01\x02");
zippedAssets.EOCDSigature = toInt("PK\x05\x06");
zippedAssets.cnOffcialZippedAssetsDir = path.join(".", "static_zip_cn_official");
zippedAssets.fileExtRegEx = /\.[^\.]+$/;
zippedAssets.contentTypeMap = new Map([
    [".html", "text/html; charset=utf-8"],
    [".js", "application/javascript; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".ExportJson", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".mp4", "video/mp4"],
    [".zip", "application/zip"],
    [".ttf", "font/ttf"],
]);
zippedAssets.defMimeType = "application/octet-stream";
zippedAssets.CNLegacyRootDir = path.join(".", "static");
zippedAssets.CNLegacyPathPrefix = "magica/resource/download/asset/master/resource";
zippedAssets.CNLegacyAssetVer = "2207081501";
zippedAssets.CNLegacyAssetJsonDir = path.join(_a.CNLegacyRootDir, _a.CNLegacyPathPrefix, _a.CNLegacyAssetVer);
zippedAssets.CNLegacy404Set = new Set([
    "/magica/css/tutorial/Tutorial.css",
    "/magica/resource/download/asset/master/resource/2112291809/movie/char/high/movie_1117_2.usm",
    "/magica/resource/download/asset/master/resource/2112291809/movie/char/high/movie_1117_3.usm",
    "/magica/resource/download/asset/master/resource/2112291809/movie/char/low/movie_1117_2.usm",
    "/magica/resource/download/asset/master/resource/2112291809/movie/char/low/movie_1117_3.usm",
    "/magica/resource/download/asset/master/resource/2207081501/asset_section_campaign_1063.json",
]);
zippedAssets.chunkSize = 1048576;
