import * as path from "path";
import * as zlib from "zlib";
import * as crypto from "crypto";
import * as fsPromises from "fs/promises";
import * as stream from "stream";
import { cnLegacyAssetJsonList } from "./cn_legacy_asset_json_list";
import { logNoLF, clampString } from "./log_no_lf";

type CDFH = {
    fileName: string,
    FHOffset: number,
    buf: Uint8Array,
}

type zipEntryName = string;
type zipFileName = string;
type compressMethod = number;
type dataStart = number;
type compressedSize = number;
type crc32 = number;
type positionInZip = [zipFileName, compressMethod, dataStart, compressedSize, crc32];

type subDirectory = "cn_official" | "cn_mod" | "cn_output";

type assetListEntry = {
    file_list: Array<{
        size: number,
        url: string,
    }>,
    md5: string,
    model?: string,
    path: string,
}

const toInt = (s: string) => {
    let buf = new Uint8Array(Buffer.from(s, 'ascii'));
    let dv = new DataView(buf.slice().buffer);
    return dv.getUint32(0, true);
}

export class zippedAssets {
    private static readonly assetJsonNames = [
        "main",
        "voice",
        "fullvoice",
        "movie_high",
        "movie_low",
    ];

    private static readonly FHSigature = toInt("PK\x03\x04");
    private static readonly CDFHSigature = toInt("PK\x01\x02");
    private static readonly EOCDSigature = toInt("PK\x05\x06");

    private static readonly cnOffcialZippedAssetsDir = path.join(".", "static_zip_cn_official");
    private readonly assetToZipMap: Map<zipEntryName, positionInZip>;
    private readonly fileHandleMap: Map<zipFileName, fsPromises.FileHandle>;

    private static readonly fileExtRegEx = /\.[^\.]+$/;
    private static readonly contentTypeMap = new Map<string, string>([
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
    static readonly defMimeType = "application/octet-stream";

    private static readonly CNLegacyRootDir = path.join(".", "static");
    private static readonly CNLegacyPathPrefix = "magica/resource/download/asset/master/resource";
    private static readonly CNLegacyAssetVer = "2207081501";
    private static readonly CNLegacyAssetJsonDir = path.join(this.CNLegacyRootDir, this.CNLegacyPathPrefix, this.CNLegacyAssetVer);
    private static readonly CNLegacy404Set = new Set<string>([
        "/magica/css/tutorial/Tutorial.css",
        "/magica/resource/download/asset/master/resource/2112291809/movie/char/high/movie_1117_2.usm",
        "/magica/resource/download/asset/master/resource/2112291809/movie/char/high/movie_1117_3.usm",
        "/magica/resource/download/asset/master/resource/2112291809/movie/char/low/movie_1117_2.usm",
        "/magica/resource/download/asset/master/resource/2112291809/movie/char/low/movie_1117_3.usm",
        "/magica/resource/download/asset/master/resource/2207081501/asset_section_campaign_1063.json",
    ]);
    static CNLegacyIsKnown404(pathInUrl: string): boolean {
        return this.CNLegacy404Set.has(pathInUrl);
    }

    private static readonly chunkSize = 1048576;


    private constructor(assetToZipMap: Map<zipEntryName, positionInZip>, fileHandleMap: Map<zipFileName, fsPromises.FileHandle>) {
        this.assetToZipMap = assetToZipMap;
        this.fileHandleMap = fileHandleMap;

        console.log(`zippedAssets: initialized, registered ${this.assetToZipMap.size} entries stored in ${this.fileHandleMap.size} zip archives`);
    }

    static async init(): Promise<zippedAssets> {
        // 1. if ./static_zip/ does not exist, try convert legacy ./static/
        // 2. scan ./static_zip/ to register zip files
        // 3. parse each zip file to create the map: requested path => zip

        console.log(`zippedAssets: init...`);

        const assetToZipMap: Map<zipEntryName, positionInZip> = new Map();
        const fileHandleMap: Map<zipFileName, fsPromises.FileHandle> = new Map();

        const zipDir = this.cnOffcialZippedAssetsDir;
        let zipFiles: Array<string>;
        try {
            zipFiles = (await fsPromises.readdir(zipDir)).filter((fileName) => fileName.endsWith('.zip'));
        } catch (e) {
            console.error(`zippedAssets: cannot open directory [${zipDir}]`, e);
            await fsPromises.mkdir(zipDir);
            zipFiles = [];
        }
        const noZipFileFound = zipFiles.length == 0;

        if (noZipFileFound || await this.isCNLegacyConversionUnfinished()) {
            if (noZipFileFound) console.error(`zippedAssets: no zip packages found in [${zipDir}]`);

            if (await this.checkIsDir(path.join(this.CNLegacyRootDir))) {
                console.log(`zippedAssets: attempt to convert legacy CN ./static/ to zip packages...`);
                return await this.convertCNLegacy();
            }
        }

        await this.registerZips(zipFiles, assetToZipMap, fileHandleMap);

        return new zippedAssets(assetToZipMap, fileHandleMap);
    }

    private static async registerZips(
        zipFiles: Array<string>, assetToZipMap: Map<zipEntryName, positionInZip>, fileHandleMap: Map<zipFileName, fsPromises.FileHandle>,
        checkConflict: boolean = false
    ): Promise<void> {
        const zipDir = this.cnOffcialZippedAssetsDir;

        const CACHED_MAP_IS_STALE = `cached map is stale`

        for (let zipFileName of zipFiles) {
            try {
                let startTime = Date.now();

                let zipFilePath = path.join(zipDir, zipFileName);
                let cachedMapPath = `${zipFilePath}.map.bin.gz`;

                let tempMap: Map<zipEntryName, positionInZip> | undefined;
                if (await this.checkIsFile(cachedMapPath)) {
                    try {
                        let zipFileMtimeMs = (await fsPromises.stat(zipFilePath)).mtimeMs;
                        let cachedMapMtimeMs = (await fsPromises.stat(cachedMapPath)).mtimeMs;

                        if (zipFileMtimeMs > cachedMapMtimeMs) throw new Error(CACHED_MAP_IS_STALE);

                        let compressed = await fsPromises.readFile(cachedMapPath);
                        let decompressed = zlib.gunzipSync(compressed);

                        let deserializedMap: Map<zipEntryName, positionInZip> = this.deserializeTempMap(decompressed);

                        for (let entry of deserializedMap.entries()) {
                            let zipEntryName = entry[0];
                            let positionInZip = entry[1];

                            if (checkConflict && assetToZipMap.has(zipEntryName)) throw new Error(`conflicting zipEntryName ${zipEntryName}`);

                            let zipFileNameInTempMap = positionInZip[0];
                            if (zipFileNameInTempMap !== zipFileName) throw new Error(`zipFileNameInTempMap !== zipFileName`);
                        };

                        tempMap = deserializedMap;

                        console.log(`zippedAssets: loaded cached map for [${zipFileName}]`);
                    } catch (e) {
                        if (e instanceof Error && e.message === CACHED_MAP_IS_STALE) {
                            console.warn(`zippedAssets: stale cached map for [${zipFileName}]`);
                        } else {
                            console.error(`zippedAssets: error loading cached map for [${zipFileName}]`, e);
                        }
                    }
                }

                let handle = await fsPromises.open(zipFilePath, "r");
                fileHandleMap.set(zipFileName, handle);

                if (tempMap == null) {
                    tempMap = await this.parseZip(zipFileName, handle);
                    let serialized = this.serializeTempMap(zipFileName, tempMap);
                    let compressed = zlib.gzipSync(serialized, { level: 1 });
                    await fsPromises.writeFile(cachedMapPath, compressed);
                }

                let lastEntryCount = assetToZipMap.size;
                tempMap.forEach((positionInZip, zipEntryName) => {
                    if (checkConflict && assetToZipMap.has(zipEntryName)) throw new Error(`conflicting zipEntryName ${zipEntryName}`);
                    assetToZipMap.set(zipEntryName, positionInZip);
                });
                let increased = assetToZipMap.size - lastEntryCount;
                let duplicate = tempMap.size - increased;
                console.log(`zippedAssets: registered [${zipFileName}]: `
                    + `added ${increased}${duplicate > 0 ? `, replaced ${duplicate}` : ""} file entries (${Date.now() - startTime}ms)`);
            } catch (e) {
                console.error(`zippedAssets: error parsing [${zipFileName}], skipped this zip`, e);
            }
        }
    }

    private static readonly mapVerMagic = toInt("map\x01");

    private static serializeTempMap(zipFileName: string, map: Map<zipEntryName, positionInZip>): Buffer {
        const SIZE_UINT32 = 4;

        const zipFileNameBuf = Buffer.from(zipFileName, 'utf-8');
        if (zipFileNameBuf.byteLength > 0xFF) throw new Error(`zipFileNameBuf.byteLength > 0xFF`);

        const zipEntryNameBufs = Array.from(map.keys()).map((s) => Buffer.from(s, 'utf-8'));
        const serializedSize = SIZE_UINT32 // verMagic
            + SIZE_UINT32 // file size
            + SIZE_UINT32 // count
            + (1 + zipFileNameBuf.byteLength + 1) // zipFileName
            + (1 + 3 * SIZE_UINT32) * map.size // entries, without zipEntryName yet
            + zipEntryNameBufs.reduce((prev, cur) => prev + (1 + cur.byteLength + 1), 0); // zipEntryName of each entry

        const buf = new Uint8Array(serializedSize);
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let offset = buf.byteOffset;

        dv.setUint32(offset, this.mapVerMagic, true); // verMagic
        offset += SIZE_UINT32;

        dv.setUint32(offset, serializedSize, true); // file size
        offset += SIZE_UINT32;

        dv.setUint32(offset, map.size, true); // count
        offset += SIZE_UINT32;

        dv.setUint8(offset++, zipFileNameBuf.byteLength);
        buf.set(zipFileNameBuf, offset); offset += zipFileNameBuf.byteLength;
        dv.setUint8(offset++, zipFileNameBuf.byteLength);

        let i = 0;
        for (let positionInZip of map.values()) {
            let zipEntryNameBuf = zipEntryNameBufs[i++];
            if (zipEntryNameBuf.byteLength > 0xFF) throw new Error(`zipEntryNameBuf.byteLength > 0xFF`);
            dv.setUint8(offset++, zipEntryNameBuf.byteLength);
            buf.set(zipEntryNameBuf, offset); offset += zipEntryNameBuf.byteLength;
            dv.setUint8(offset++, zipEntryNameBuf.byteLength);

            dv.setUint8(offset++, positionInZip[1]); // compressMethod
            dv.setUint32(offset, positionInZip[2], true); offset += SIZE_UINT32; // dataStart
            dv.setUint32(offset, positionInZip[3], true); offset += SIZE_UINT32; // compressedSize
            dv.setUint32(offset, positionInZip[4], true); offset += SIZE_UINT32; // crc32
        }

        if (offset != buf.byteLength) throw new Error(`offset != buf.byteLength`);

        return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    private static deserializeTempMap(serialized: Buffer): Map<zipEntryName, positionInZip> {
        const SIZE_UINT32 = 4;

        const map = new Map<zipEntryName, positionInZip>();

        const buf = new Uint8Array(serialized.buffer, serialized.byteOffset, serialized.byteLength);
        const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let offset = buf.byteOffset;

        if (dv.getUint32(offset, true) != this.mapVerMagic) throw new Error(`verMagic mismatch`);
        offset += SIZE_UINT32;

        const serializedSize = dv.getUint32(offset, true);
        offset += SIZE_UINT32;
        if (serializedSize != buf.byteLength) throw new Error(`serializedSize ${serializedSize} != buf.byteLength ${buf.byteLength}`);
        const end = buf.byteOffset + serializedSize;

        const count = dv.getUint32(offset, true);
        offset += SIZE_UINT32;

        const zipFileNameBufSize = dv.getUint8(offset++);
        const zipFileName = Buffer.from(buf.buffer, offset, zipFileNameBufSize).toString('utf-8');
        offset += zipFileNameBufSize;
        if (dv.getUint8(offset++) != zipFileNameBufSize) throw new Error(`zipFileNameBufSize mismatch`);

        while (offset < end) {
            let zipEntryNameBufSize = dv.getUint8(offset++);
            let zipEntryName = Buffer.from(buf.buffer, offset, zipEntryNameBufSize).toString('utf-8');
            offset += zipEntryNameBufSize;
            if (dv.getUint8(offset++) != zipEntryNameBufSize) throw new Error(`zipEntryNameBufSize mismatch`);

            let compressMethod = dv.getUint8(offset++);
            let dataStart = dv.getUint32(offset, true); offset += 4;
            let compressedSize = dv.getUint32(offset, true); offset += 4;
            let crc32 = dv.getUint32(offset, true); offset += 4;

            map.set(zipEntryName, [zipFileName, compressMethod, dataStart, compressedSize, crc32]);
        }

        if (offset != end) throw new Error(`offset != end`);
        if (map.size != count) throw new Error(`map.size != count`);

        return map;
    }

    private static async convertCNLegacy(): Promise<zippedAssets> {
        this.markCNLegacyConversionFinished(false);

        console.log(`zippedAssets: converting CN legacy ./static/ ...`);

        const assetToZipMap: Map<zipEntryName, positionInZip> = new Map();
        const fileHandleMap: Map<zipFileName, fsPromises.FileHandle> = new Map();

        const zipDir = this.cnOffcialZippedAssetsDir;

        // (1) downloaded assets
        for (let name of this.assetJsonNames) {
            console.log(`zippedAssets: converting legacy CN static resource [${name}] ...`);

            let jsonPath = path.join(this.CNLegacyAssetJsonDir, `zip_asset_${name}.json`);
            let assetJSON = JSON.parse(await fsPromises.readFile(jsonPath, 'utf-8'));

            let joinedZipFileName = `cn_official_asset_${name}_joined.zip`;
            let outPath = path.join(zipDir, joinedZipFileName);

            if (await this.checkFileFinished(outPath, true)) {
                console.log(`zippedAssets: already finished: [${joinedZipFileName}]`);
                await this.registerZips([joinedZipFileName], assetToZipMap, fileHandleMap);
                continue;
            }

            let outHandle = await fsPromises.open(outPath, "w+");

            let entryNameSet = new Set<zipEntryName>();
            let CDFHBufs: Array<Uint8Array> = [];

            let offset = 0;

            for (let item of assetJSON) {
                if (item.file_list.length != 1) throw new Error(`item.file_list.length != 1`);

                let zipFilePath = `${this.CNLegacyPathPrefix}/${item.file_list[0].url}`;

                let inHandle = await fsPromises.open(path.join(this.CNLegacyRootDir, zipFilePath), "r");
                let zipFileSize = (await inHandle.stat()).size;
                let crc32 = await this.crc32(inHandle);

                let CDFHList: Array<CDFH> = [];
                await this.parseZip(zipFilePath, inHandle, CDFHList);

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
                    write: (chunk, encoding, callback) => { outHandle.write(chunk).then(() => { callback(); }) },
                    writev: (chunks, callback) => { outHandle.writev(chunks.map(c => c.chunk)).then(() => { callback(); }) },
                    highWaterMark: this.chunkSize,
                });
                await new Promise<void>((resolve, reject) => {
                    inStream.on('close', () => { resolve(); });
                    stream.pipeline(inStream, outStream, (err) => { reject(err); });
                });
                offset += zipFileSize;

                logNoLF(`zippedAssets: [${clampString(joinedZipFileName)}]: written [${clampString(zipFilePath)}]`);
            }

            process.stdout.write("\n");

            let newEOCD = this.newEOCD(CDFHBufs.length, CDFHBufs.reduce((prev, cur) => prev + cur.byteLength, 0), offset);

            await outHandle.writev(CDFHBufs);
            await outHandle.write(newEOCD);
            await outHandle.sync();
            await outHandle.close();
            await this.markFileFinished(outPath);

            await this.registerZips([joinedZipFileName], assetToZipMap, fileHandleMap);

            console.log(`zippedAssets: packed ${entryNameSet.size} files into [${joinedZipFileName}], ${assetToZipMap.size} packed files in total`);
        }


        // web resources
        console.log(`zippedAssets: converting web resources...`);
        const replacementJs = "js/system/replacement.js";
        const replacementJsPath = path.join(this.CNLegacyRootDir, `magica/${replacementJs}`);
        const webResFileList = Object.keys(JSON.parse((await fsPromises.readFile(replacementJsPath, 'utf-8')).replace("window.fileTimeStamp=", "")));

        // supplements to replacement.js
        cnLegacyAssetJsonList.forEach((json) => webResFileList.push(`${this.CNLegacyPathPrefix.replace(/^magica\//, "")}/${this.CNLegacyAssetVer}/${json}`));
        webResFileList.push(replacementJs);
        webResFileList.push("js/_common/baseConfig.js");
        webResFileList.push("index.html");

        let CDFHBufs: Array<Uint8Array> = [];

        const webResZipFileName = "cn_official_web_res.zip";
        const webResZipPath = path.join(zipDir, webResZipFileName);

        if (await this.checkFileFinished(webResZipPath, true)) {
            console.log(`zippedAssets: already finished: [${webResZipFileName}]`);
            await this.registerZips([webResZipFileName], assetToZipMap, fileHandleMap, true);
            this.markCNLegacyConversionFinished(true);
            return new zippedAssets(assetToZipMap, fileHandleMap);
        }

        let outHandle = await fsPromises.open(webResZipPath, "w+");

        let offset = 0;
        let skippedCount = 0;

        for (let webResFileName of webResFileList) {
            let pathInZip = `magica/${webResFileName}`.split("/").map((s) => encodeURIComponent(s)).join("/");

            if (this.CNLegacy404Set.has(`/${pathInZip}`)) {
                skippedCount++;
                continue;
            }

            let webResFilePath = path.join(this.CNLegacyRootDir, pathInZip);
            let inHandle = await fsPromises.open(webResFilePath, "r");
            let inflatedSize = (await inHandle.stat()).size;
            let inflated = new Uint8Array(inflatedSize);
            await inHandle.read(inflated, 0, inflatedSize, 0);

            let crc32 = await this.crc32(inHandle);

            inHandle.close();

            let compressMethod = 8;
            let deflated: Uint8Array = zlib.deflateRawSync(inflated, { level: 9 });
            deflated = new Uint8Array(deflated.buffer, deflated.byteOffset, deflated.byteLength);
            let deflatedSize = deflated.byteLength;

            if (deflatedSize >= inflatedSize) {
                compressMethod = 0;
                deflated = inflated
                deflatedSize = inflatedSize;
            }

            let fileHeader = this.newFileHeader(pathInZip, compressMethod, deflatedSize, inflatedSize, crc32);
            await outHandle.write(fileHeader);
            let headerBeforeDeflated = offset;
            offset += fileHeader.byteLength;
            let deflatedStart = offset;

            await outHandle.write(deflated);
            offset += deflated.byteLength;

            logNoLF(`zippedAssets: [${clampString(webResZipFileName)}]: written [${clampString(pathInZip)}]`);

            CDFHBufs.push(this.newCDFH(pathInZip, headerBeforeDeflated, compressMethod, deflatedSize, inflatedSize, crc32));
        }

        process.stdout.write("\n");

        let newEOCD = this.newEOCD(CDFHBufs.length, CDFHBufs.reduce((prev, cur) => prev + cur.byteLength, 0), offset);

        await outHandle.writev(CDFHBufs);
        await outHandle.write(newEOCD);
        await outHandle.sync();
        await outHandle.close();
        await this.markFileFinished(webResZipPath);

        await this.registerZips([webResZipFileName], assetToZipMap, fileHandleMap, true);

        console.log(`zippedAssets: packed ${webResFileList.length - skippedCount} files into [${webResZipFileName}], ${assetToZipMap.size} packed files in total`);


        console.log(`zippedAssets: packed ${assetToZipMap.size} files into ${fileHandleMap.size} zip archives in total`);

        this.markCNLegacyConversionFinished(true);

        return new zippedAssets(assetToZipMap, fileHandleMap);
    }

    private static async isCNLegacyConversionUnfinished(): Promise<boolean> {
        const markerPath = path.join(this.cnOffcialZippedAssetsDir, "conversion_is_unfinished");
        return await this.checkIsDir(markerPath);
    }

    private static async markCNLegacyConversionFinished(finished: boolean): Promise<void> {
        const markerPath = path.join(this.cnOffcialZippedAssetsDir, "conversion_is_unfinished");
        if (await this.checkIsDir(markerPath) == !finished) return;
        await fsPromises[finished ? "rmdir" : "mkdir"](markerPath);
    }


    // integrity check
    readonly integrityCheckStatus = new integrityCheckStatus();

    checkIntegrity(subDirectory: subDirectory = "cn_official"): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const status = this.integrityCheckStatus;
            const isAlreadyRunning = status.isRunning;
            if (isAlreadyRunning) console.warn(`zippedAssets: checkIntegrity is already running`);
            const resultPromise = status.getPendingResult();
            resultPromise.then((result) => resolve(result)).catch((e) => reject(e));
            if (!isAlreadyRunning) this._checkIntegrity(subDirectory).then(() => status.notifyDone()).catch((e) => status.notifyError(e));
        });
    }
    private async _checkIntegrity(subDirectory: subDirectory = "cn_official"): Promise<void> {
        console.log(`zippedAssets: checkIntegrity for ${subDirectory}...`);

        const md5Map = new Map<zipEntryName, md5>();
        const webResFileSet = new Set<zipEntryName>();
        const extraSet = new Set<zipEntryName>();

        const status = this.integrityCheckStatus;


        // fill md5Map, according to official asset list jsons
        const prefix = `/${zippedAssets.CNLegacyPathPrefix}/${zippedAssets.CNLegacyAssetVer}/`;

        const assetJsonFileNames: Array<string> = [];
        zippedAssets.assetJsonNames.forEach((name) => {
            name = `asset_${name}.json`;
            assetJsonFileNames.push(name);
            name = `zip_${name}`;
            assetJsonFileNames.push(name);
        });

        for (let fileName of assetJsonFileNames) {
            let pathInUrl = `${prefix}${fileName}`;
            let data = await this.readFileAsync(pathInUrl);
            if (data == null) throw new Error(`cannot read asset list json`);

            let assetList: Array<assetListEntry> = JSON.parse(data.toString('utf-8'));

            for (let entry of assetList) {
                if (entry.file_list.length != 1) throw new Error(`entry.file_list.length != 1`);
                let pathInUrl = `/${zippedAssets.CNLegacyPathPrefix}/${entry.file_list[0].url}`;
                if (zippedAssets.CNLegacy404Set.has(pathInUrl)) continue;
                let pathInZip = this.getPathInZip(pathInUrl);
                if (pathInZip == null) {
                    status.addMissing(pathInUrl);
                    logNoLF(`zippedAssets: md5: [MISSING] [${clampString(pathInUrl)}]` + `\n`);
                    continue;
                }
                let md5 = entry.md5;
                md5Map.set(pathInZip, md5);
            }
        }

        // fill webResFileSet, according to replacement.js
        const replacementJs = "js/system/replacement.js";
        const replacementJsPathInUrl = `/magica/${replacementJs}`;
        const webResFileListData = (await this.readFileAsync(replacementJsPathInUrl))?.toString('utf-8');
        if (webResFileListData == null) throw new Error(`cannot read replacement.js`);
        Object.keys(JSON.parse(webResFileListData.replace("window.fileTimeStamp=", ""))).forEach((partialPath) => {
            let pathInZip = `magica/${partialPath}`.split("/").map((s) => encodeURIComponent(s)).join("/");
            let pathInUrl = `/${pathInZip}`;
            if (!zippedAssets.CNLegacy404Set.has(pathInUrl)) webResFileSet.add(pathInZip);
        });

        // supplements to replacement.js
        cnLegacyAssetJsonList.forEach((json) => webResFileSet.add(`${zippedAssets.CNLegacyPathPrefix}/${zippedAssets.CNLegacyAssetVer}/${json}`));
        [
            replacementJs,
            "js/_common/baseConfig.js",
            "index.html",
        ].forEach((partialPath) => webResFileSet.add(`magica/${partialPath}`));

        // fill extraSet, contains files outside asset list jsons and replacement.js
        for (let zipEntryName of this.assetToZipMap.keys()) {
            if (!md5Map.has(zipEntryName) && !webResFileSet.has(zipEntryName)) {
                extraSet.add(zipEntryName);
            }
        }


        status.init(md5Map, webResFileSet, extraSet);


        // check against md5Map
        for (let entry of md5Map) {
            let pathInZip = entry[0];
            let expected = entry[1];

            let data = await this.readFileAsync(pathInZip);
            if (data == null) {
                status.addMissing(pathInZip);
                logNoLF(`zippedAssets: md5: [MISSING] [${clampString(pathInZip)}]` + `\n`);
                continue;
            }

            let md5 = crypto.createHash("md5").update(data).digest().toString('hex').toLowerCase();
            let okay = md5 === expected;
            if (!okay) {
                status.addMismatch(pathInZip, "md5");
            } else {
                status.addPassed(pathInZip);
            }

            logNoLF(`zippedAssets: md5: [${okay ? "OK" : "FAIL"}] [${clampString(pathInZip)}]` + `${okay ? "" : "\n"}`);
        }

        process.stdout.write("\n");

        // check against webResFileSet
        for (let pathInZip of webResFileSet.keys()) {
            let found = this.getPathInZip(pathInZip);
            if (found == null) {
                status.addMissing(pathInZip);
                logNoLF(`zippedAssets: webRes: [MISSING] [${clampString(pathInZip)}]` + `\n`);
                continue;
            }

            let data = await this.readFileAsync(pathInZip, true);
            let okay = data != null;
            if (!okay) {
                status.addMismatch(pathInZip, "crc32");
            } else {
                status.addPassed(pathInZip);
            }

            logNoLF(`zippedAssets: webRes: [${okay ? "OK" : "FAIL"}] [${clampString(pathInZip)}]` + `${okay ? "" : "\n"}`);
        }

        process.stdout.write("\n");

        // check against extraSet
        for (let pathInZip of extraSet.keys()) {
            let data = await this.readFileAsync(pathInZip, true);
            let okay = data != null;
            if (!okay) {
                status.addMismatch(pathInZip, "crc32");
            } else {
                status.addPassed(pathInZip);
            }
            logNoLF(`zippedAssets: extra: [${okay ? "OK" : "FAIL"}] [${clampString(pathInZip)}]` + `${okay ? "" : "\n"}`);
        }

        process.stdout.write("\n");


        const isAllPassed = status.isAllPassed;
        console.log(`zippedAssets: checkIntegrity ${isAllPassed ? "OK" : "FAIL"}`);
        console.log(`zippedAssets: ${status.totalCount} total, ${status.passedCount} ok, ${status.failedCount} failed`);
        if (!isAllPassed) console.log(`zippedAssets: ${status.missingCount} missing, ${status.md5MismatchCount} md5 mismatch, ${status.crc32MismatchCount} crc32 mismatch`);
    }


    private static crc32(data: fsPromises.FileHandle | Uint8Array): Promise<number> {
        return new Promise((resolve, reject) => {
            let inStream: stream.Readable;
            try {
                if (data instanceof Uint8Array) {
                    inStream = new stream.PassThrough().end(data);
                } else {
                    inStream = data.createReadStream({ start: 0, autoClose: false, highWaterMark: this.chunkSize });
                }
            } catch (e) {
                reject(e);
                return;
            }
            let gzip = zlib.createGzip({ level: 0, chunkSize: this.chunkSize });
            let lastChunk: Buffer;
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


    private static async parseZip(
        zipFileName: string, handle: fsPromises.FileHandle, outCDFHList?: Array<CDFH>
    ): Promise<Map<zipEntryName, positionInZip>> {
        const tempMap: Map<zipEntryName, positionInZip> = new Map();

        const { CDOffset, CDSize } = await this.findEOCD(handle);
        let CDBuf = new Uint8Array(CDSize);
        await handle.read(CDBuf, 0, CDSize, CDOffset);

        if (outCDFHList == null) outCDFHList = [];
        while (CDBuf.byteLength > 0) {
            CDBuf = this.parseCDFH(CDBuf, outCDFHList);
        }

        for (let CDFH of outCDFHList) {
            let FHOffset = CDFH.FHOffset;
            let FHBuf = new Uint8Array(30);
            await handle.read(FHBuf, 0, FHBuf.byteLength, FHOffset);
            let dv = new DataView(FHBuf.buffer, FHBuf.byteOffset, FHBuf.byteLength);
            let signature = dv.getUint32(0, true);
            if (signature != this.FHSigature) throw new Error(`file header signature mismatch`);
            let compressMethod = dv.getUint16(8, true);
            let crc32 = dv.getUint32(14, true);
            let compressedSize = dv.getUint32(18, true);
            let fileNameLen = dv.getUint16(26, true);
            let extraFieldLen = dv.getUint16(28, true);
            let dataOffset = FHOffset + 30 + fileNameLen + extraFieldLen;
            let dataEnd = dataOffset + compressedSize;
            if (dataEnd > CDOffset) throw new Error(`[${zipFileName} / ${CDFH.fileName}] end of compressed data exceeds begin of central directory`);
            tempMap.set(CDFH.fileName, [zipFileName, compressMethod, dataOffset, compressedSize, crc32]);
        }

        return tempMap;
    }

    private static async readFileHeader(handle: fsPromises.FileHandle, offset: number): Promise<Uint8Array> {
        let buf = new Uint8Array(30);
        await handle.read(buf, 0, buf.byteLength, offset);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.FHSigature) throw new Error(`file header signature mismatch`);
        let fileNameLen = dv.getUint16(26, true);
        let extraFieldLen = dv.getUint16(28, true);
        let len = 30 + fileNameLen + extraFieldLen;
        let newBuf = new Uint8Array(len);
        newBuf.set(buf);
        buf = newBuf;
        await handle.read(buf, 30, len - 30, offset + 30);
        return buf;
    }

    private static newFileHeader(entryName: string, compressMethod: number, deflatedSize: number, inflatedSize: number, crc32: number): Uint8Array {
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

    private static modifyFileHeader(buf: Uint8Array, entryName: string, newDataSize: number, crc32: number): Uint8Array {
        let newRawFileName = Buffer.from(entryName, 'ascii');
        let newFileNameLen = newRawFileName.byteLength;

        let oldBuf = buf;
        buf = new Uint8Array(30 + newFileNameLen);
        buf.set(oldBuf.subarray(0, 30), 0);
        buf.set(newRawFileName, 30);

        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.FHSigature) throw new Error(`file header signature mismatch`);
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

    private static parseCDFH(buf: Uint8Array, outCDFHList: Array<CDFH>): Uint8Array {
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.CDFHSigature) throw new Error(`CDFH signature mismatch`);
        let fileNameLen = dv.getUint16(28, true);
        let extraFieldLen = dv.getUint16(30, true);
        let commentLen = dv.getUint16(32, true);
        let fileName = Buffer.from(buf.subarray(46, 46 + fileNameLen)).toString('ascii');
        let FHOffset = dv.getUint32(42, true);
        let len = 46 + fileNameLen + extraFieldLen + commentLen;
        if (len > buf.byteLength) throw new Error(`unexpected EOF`);
        let CDFH = new Uint8Array(buf.buffer, buf.byteOffset, len);
        let remaining = new Uint8Array(buf.buffer, buf.byteOffset + len);
        outCDFHList.push({
            fileName: fileName,
            FHOffset: FHOffset,
            buf: CDFH,
        });
        return remaining;
    }

    private static newCDFH(entryName: string, FHOffset: number, compressMethod: number, deflatedSize: number, inflatedSize: number, crc32: number): Uint8Array {
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

    private static modifyCDFH(
        entryNameSet: Set<zipEntryName>, buf: Uint8Array, offset: number, entryName?: string, newDataSize?: number, crc32?: number
    ): Uint8Array {
        let newRawFileName: Uint8Array;
        let newFileNameLen: number;
        if (entryName != null) {
            newRawFileName = Buffer.from(entryName, 'ascii');
            newFileNameLen = newRawFileName.byteLength;
        } else {
            let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
            newFileNameLen = dv.getUint16(28, true);
            newRawFileName = buf.subarray(46, 46 + newFileNameLen);
            entryName = Buffer.from(newRawFileName).toString('ascii');
        }

        if (entryNameSet.has(entryName)) throw new Error(`conflicting entryName ${entryName}`);
        else entryNameSet.add(entryName);
        if (entryName.length != newRawFileName.byteLength) throw new Error(`${entryName} string length != raw length`);
        if (newRawFileName.length == 0) throw new Error(`${entryName} raw length == 0`);

        let oldBuf = buf;
        buf = new Uint8Array(46 + newFileNameLen);
        buf.set(oldBuf.subarray(0, 46), 0);
        buf.set(newRawFileName, 46);

        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        let signature = dv.getUint32(0, true);
        if (signature != this.CDFHSigature) throw new Error(`CDFH signature mismatch`);
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

    private static async findEOCD(handle: fsPromises.FileHandle, outEOCD?: [Uint8Array]): Promise<{ CDOffset: number, CDSize: number }> {
        const EOCDMin = 22;
        const EOCDMax = EOCDMin + 0xFFFF;

        const stat = await handle.stat();
        const fileSize = stat.size;

        const buf = new Uint8Array(Math.min(fileSize, EOCDMax));
        const dv = new DataView(buf.buffer);
        await handle.read(buf, 0, buf.byteLength, fileSize - buf.byteLength);

        for (let offset = dv.byteLength - EOCDMin; offset >= 0; offset--) {
            let signature = dv.getUint32(offset, true);
            if (signature != this.EOCDSigature) continue;
            let commentLen = dv.getUint16(offset + 20, true);
            if (offset + EOCDMin + commentLen != dv.byteLength) continue;
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

    private static newEOCD(CDFHCount: number, CDSize: number, CDOffset: number): Uint8Array {
        let buf = new Uint8Array(22);
        let dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        dv.setUint32(0, this.EOCDSigature, true);
        dv.setUint16(8, CDFHCount, true);
        dv.setUint16(10, CDFHCount, true);
        dv.setUint32(12, CDSize, true);
        dv.setUint32(16, CDOffset, true);
        return buf;
    }


    private static async checkIsDir(dirPath: string): Promise<boolean> {
        try {
            return (await fsPromises.stat(dirPath)).isDirectory();
        } catch (e) {
            return false;
        }
    }

    private static async checkIsFile(filePath: string): Promise<boolean> {
        try {
            return (await fsPromises.stat(filePath)).isFile();
        } catch (e) {
            return false;
        }
    }

    private static async checkFileFinished(filePath: string, markIfUnfinished: boolean = false): Promise<boolean> {
        let markerPath = `${filePath}.unfinished`;
        if (await this.checkIsFile(filePath) && !await this.checkIsDir(markerPath)) return true;
        if (markIfUnfinished && !await this.checkIsDir(markerPath)) await fsPromises.mkdir(markerPath);
        return false;
    }

    private static async markFileFinished(filePath: string): Promise<void> {
        let markerPath = `${filePath}.unfinished`;
        try {
            await fsPromises.rmdir(markerPath);
        } catch (e) { }
    }


    getPathInZip(pathInUrl: string): string | undefined {
        // (1) lookup directly (web_res.zip)
        let pathInZip = pathInUrl.replace(/^\//, "");
        if (this.assetToZipMap.has(pathInZip)) return pathInZip;

        // (2) cn joined zips use stripped paths
        pathInZip = pathInZip.replace(/^magica\/resource\/(download\/asset\/master\/resource\/\d+\/|)/, "");
        if (this.assetToZipMap.has(pathInZip)) return pathInZip;

        console.error(`zippedAssets: cannot find [${pathInZip}] in any zip file (pathInUrl=[${pathInUrl}])`);
    }

    async readFileAsync(pathInUrl: string, crc32?: boolean | number): Promise<Buffer | undefined> {
        const pathInZip = this.getPathInZip(pathInUrl);
        if (pathInZip == null) return;
        let val = this.assetToZipMap.get(pathInZip);
        if (val == null) return;

        const zipFileName = val[0];
        const method = val[1];
        const dataOffset = val[2];
        const compressedSize = val[3];
        if (typeof crc32 === 'boolean') crc32 = crc32 ? val[4] : undefined;

        let data: Uint8Array | undefined;

        for (let retries = 3; retries > 0 && data == null; retries--) {
            try {
                data = await this.extract(zipFileName, method, dataOffset, compressedSize, crc32);
            } catch (e) {
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

    static getContentType(pathInUrl: string) {
        let contentTypeMap: string | undefined;
        let matched = pathInUrl.match(this.fileExtRegEx);
        if (matched) contentTypeMap = this.contentTypeMap.get(matched[0]);
        if (contentTypeMap != null) return contentTypeMap;
        else return this.defMimeType;
    }

    private async extract(
        zipFileName: string, method: number, dataOffset: number, compressedSize: number, crc32?: number
    ): Promise<Uint8Array | undefined> {
        let handle = this.fileHandleMap.get(zipFileName);
        if (handle == null) {
            const zipFilePath = path.join(zippedAssets.cnOffcialZippedAssetsDir, zipFileName);
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
            let calculated = await zippedAssets.crc32(buf);
            if (crc32 != calculated) return;
        }

        return buf;
    }
}

type md5 = string;
class integrityCheckStatus {
    private md5Map = new Map<zipEntryName, string>();
    private webResFileSet = new Set<zipEntryName>();
    private extraSet = new Set<zipEntryName>();
    private _totalCount?: number;
    get totalCount(): number {
        const size = this.md5Map.size + this.webResFileSet.size + this.extraSet.size;
        if (size == 0 && this._totalCount != null) return this._totalCount;
        return size;
    }

    private readonly okaySet = new Set<zipEntryName>();
    private readonly missingSet = new Set<zipEntryName>();
    private readonly md5MismatchSet = new Set<zipEntryName>();
    private readonly crc32MismatchSet = new Set<zipEntryName>();
    addPassed(pathInZip: zipEntryName): void {
        this.okaySet.add(pathInZip);
    }
    addMissing(pathInZip: zipEntryName): void {
        this.missingSet.add(pathInZip);
    }
    addMismatch(pathInZip: zipEntryName, checksumType: "md5" | "crc32"): void {
        switch (checksumType) {
            case "md5": this.md5MismatchSet.add(pathInZip); return;
            case "crc32": this.crc32MismatchSet.add(pathInZip); return;
            default: throw new Error(`unknown checksum type [${checksumType}]`);
        }
    }

    private _passedCount?: number;
    get passedCount(): number {
        const size = this.okaySet.size;
        if (size == 0 && this._passedCount != null) return this._passedCount;
        return size;
    }
    private _missingCount?: number;
    get missingCount(): number {
        const size = this.missingSet.size;
        if (size == 0 && this._missingCount != null) return this._missingCount;
        return size;
    }
    private _md5MismatchCount?: number;
    get md5MismatchCount(): number {
        const size = this.md5MismatchSet.size;
        if (size == 0 && this._md5MismatchCount != null) return this._md5MismatchCount;
        return size;
    }
    private _crc32MismatchCount?: number;
    get crc32MismatchCount(): number {
        const size = this.crc32MismatchSet.size;
        if (size == 0 && this._crc32MismatchCount != null) return this._crc32MismatchCount;
        return size;
    }

    get failedCount(): number {
        return this.missingCount + this.md5MismatchCount + this.crc32MismatchCount;
    }
    get doneCount(): number {
        return this.passedCount + this.failedCount;
    }
    get remainingCount(): number {
        return this.totalCount - this.doneCount;
    }
    get isAllPassed(): boolean {
        return this.totalCount == this.passedCount;
    }

    isFilePassed(pathInZip: zipEntryName): boolean {
        return this.okaySet.has(pathInZip);
    }

    get statusString(): string {
        return `[${this.passedCount}] passed, [${this.remainingCount}] remaining`
            + `, [${this.failedCount}] missing/mismatch/error`;
    }

    clear(keepCounts: boolean = false): void {
        if (keepCounts) {
            this._totalCount = this.totalCount;
            this._passedCount = this.passedCount;
            this._missingCount = this.missingCount;
            this._md5MismatchCount = this.md5MismatchCount;
            this._crc32MismatchCount = this.crc32MismatchCount;
        }
        const excludeIndex = Object.keys(this).findIndex((name) => name === "pendingRequestSet");
        const values = Object.values(this);
        values.splice(excludeIndex, 1);
        values.filter((val) => val instanceof Set || val instanceof Map).forEach((val) => val.clear());
    }
    init(md5Map: Map<zipEntryName, string>, webResFileSet: Set<zipEntryName>, extraSet: Set<zipEntryName>): void {
        this.clear();
        this.md5Map = md5Map;
        this.webResFileSet = webResFileSet;
        this.extraSet = extraSet;
    }

    private readonly pendingRequestSet = new Set<{
        resolve: (result: boolean | PromiseLike<boolean>) => void,
        reject: (error?: any) => void,
    }>();
    get isRunning(): boolean {
        return this.pendingRequestSet.size > 0;
    }
    getPendingResult(): Promise<boolean> {
        return new Promise((resolve, reject) => this.pendingRequestSet.add({ resolve: resolve, reject: reject }));
    }
    notifyDone(): void {
        const result = this.passedCount == this.totalCount;
        this.clear(true);
        for (let r of this.pendingRequestSet) r.resolve(result);
        this.pendingRequestSet.clear();
    }
    notifyError(e?: any): void {
        this.clear();
        for (let r of this.pendingRequestSet) r.reject(e);
        this.pendingRequestSet.clear();
    }
}