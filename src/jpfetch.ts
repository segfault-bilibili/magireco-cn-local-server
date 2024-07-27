import * as http2 from "http2";
import * as tls from "tls";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as crypto from "crypto";
import * as replacementCn from "./replacement_cn";

const parseBurpXml = (xml: string) => {
    let splitted = xml.split('\n').map((s) => s.replace(/\r$/, ''));
    let base64 = splitted.find(s => s.match(/^\s*<response\s+base64/))?.replace(/(^\s*<response.+\[CDATA\[)|(\]\].*$)/g, "");
    let responselength = Number(splitted.find(s => s.match(/^\s*<responselength>/))?.replace(/(^\s*<responselength>)|(<\/responselength>.*$)/g, ""));
    if (isNaN(responselength)) throw new Error(`responselength is NaN`);
    if (base64 == null) throw new Error(`base64 == null`);
    let response: Buffer | string = Buffer.from(base64, 'base64');
    if (response.byteLength < responselength) throw new Error(`response.byteLength ${response.byteLength} < responselength ${responselength}`);
    response = response.subarray(0, responselength).toString('utf-8');
    let body = response.substring(response.indexOf("\r\n\r\n") + 4);
    let data = JSON.parse(body);
    return data;
}

const readBurpXml = (filepath: string) => {
    if (!filepath.endsWith('.xml')) throw new Error(`not ended with xml`);
    let xml = fs.readFileSync(filepath, 'utf-8');
    return parseBurpXml(xml);
}

const outdir = path.join(".", "static_staging_jp");

const domain = "android.magi-reco.com";
const authority = `https://${domain}`;
const cacerts: string[] = Array.from(tls.rootCertificates);
const socksAuth = Buffer.from(new Uint8Array([0x05, 0x01, 0x00]));
const socksAuthSucceeded = Buffer.from(new Uint8Array([0x05, 0x00]));
const socksConnect = Buffer.concat([new Uint8Array([0x05, 0x01, 0x00, 0x03, domain.length]), Buffer.from(domain, "ascii"), new Uint8Array([0x01, 0xBB])]);
const socksConnectSucceeded = Buffer.from(new Uint8Array([0x05, 0x00, 0x00, 0x01]));

const index404 = Buffer.from(`PGh0bWwgbGFuZz0iamEiIHN0eWxlPSJoZWlnaHQ6IDU3NnB4OyI+Cgo8aGVhZD4KICAgIDxtZXRh`
    + `IGNoYXJzZXQ9IlVURi04Ij4KICAgIDx0aXRsZT5tYWdpY2E8L3RpdGxlPgogICAgPG1ldGEgaWQ9`
    + `InZpZXdwb3J0IiBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9MTAyNCwgdXNlci1zY2Fs`
    + `YWJsZT1ubyI+CiAgICA8bWV0YSBuYW1lPSJmb3JtYXQtZGV0ZWN0aW9uIiBjb250ZW50PSJlbWFp`
    + `bD1ubyx0ZWxlcGhvbmU9bm8iPgogICAgPG1ldGEgbmFtZT0iYXBwbGUtbW9iaWxlLXdlYi1hcHAt`
    + `Y2FwYWJsZSIgY29udGVudD0ieWVzIj4KICAgIDxsaW5rIHJlbD0ic3R5bGVzaGVldCIgaHJlZj0i`
    + `L21hZ2ljYS9jc3MvX2NvbW1vbi9zYW5pdGl6ZS5jc3MiPgogICAgPGxpbmsgcmVsPSJzdHlsZXNo`
    + `ZWV0IiBocmVmPSIvbWFnaWNhL2Nzcy9fY29tbW9uL2NvbW1vbi5jc3MiPgogICAgPGxpbmsgcmVs`
    + `PSJzdHlsZXNoZWV0IiBocmVmPSIvbWFnaWNhL2Nzcy9fY29tbW9uL2Jhc2UuY3NzIj4KICAgIDxz`
    + `dHlsZSBpZD0iaGVhZFN0eWxlIj4KICAgICNOZXdWZXJzaW9uUmVjb21tZW5kIHsKICAgICAgICB3`
    + `aWR0aDogMTAyNHB4OwogICAgICAgIGhlaWdodDogMTAwJTsKICAgICAgICBvdmVyZmxvdzogaGlk`
    + `ZGVuOwogICAgfQoKICAgICNOZXdWZXJzaW9uUmVjb21tZW5kIC50b3BCdG4gewogICAgICAgIHdp`
    + `ZHRoOiAxMTBweDsKICAgICAgICBoZWlnaHQ6IDI4cHg7CiAgICAgICAgYmFja2dyb3VuZDogdXJs`
    + `KCIvbWFnaWNhL3Jlc291cmNlL2ltYWdlX3dlYi9wYWdlL3RvcC9idG5fYmcwMC5wbmciKSBsZWZ0`
    + `IHRvcCBuby1yZXBlYXQ7CiAgICAgICAgYmFja2dyb3VuZC1zaXplOiAxMTBweCAyOHB4OwogICAg`
    + `ICAgIGRpc3BsYXk6IGlubGluZS1ibG9jazsKICAgICAgICBjb2xvcjogIzZlNmU2ZTsKICAgICAg`
    + `ICBmb250LXNpemU6IDEycHg7CiAgICAgICAgbGluZS1oZWlnaHQ6IDI4cHg7CiAgICAgICAgdGV4`
    + `dC1hbGlnbjogY2VudGVyOwogICAgICAgIHRleHQtc2hhZG93OiAwIDA7CiAgICB9CgogICAgI05l`
    + `d1ZlcnNpb25SZWNvbW1lbmQgLmxvZ28gewogICAgICAgIHdpZHRoOiA3MjhweDsKICAgICAgICBw`
    + `b3NpdGlvbjogYWJzb2x1dGU7CiAgICAgICAgdG9wOiAtd2Via2l0LWNhbGMoNTAlIC0gMjgwcHgp`
    + `OwogICAgICAgIGxlZnQ6IC13ZWJraXQtY2FsYyg1MCUgLSAzNjRweCk7CiAgICB9CgogICAgI05l`
    + `d1ZlcnNpb25SZWNvbW1lbmQgLmxvZ28gaW1nIHsKICAgICAgICB3aWR0aDogNzI4cHg7CiAgICB9`
    + `CgogICAgI05ld1ZlcnNpb25SZWNvbW1lbmQgI3RyYW5zZmVySW5uZXIgewogICAgICAgIGRpc3Bs`
    + `YXk6IG5vbmU7CiAgICB9CgogICAgI05ld1ZlcnNpb25SZWNvbW1lbmQgI21vdmllU3RhcnRCdG4g`
    + `ewogICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTsKICAgICAgICBib3R0b206IDIwcHg7CiAgICAg`
    + `ICAgbGVmdDogMjBweDsKICAgICAgICB6LWluZGV4OiA4MDsKICAgIH0KCiAgICAjTmV3VmVyc2lv`
    + `blJlY29tbWVuZCAjdHJhbnNmZXJCdG4gewogICAgICAgIGRpc3BsYXk6IGJsb2NrOwogICAgICAg`
    + `IHBvc2l0aW9uOiBhYnNvbHV0ZTsKICAgICAgICBib3R0b206IDEwcHg7CiAgICAgICAgbGVmdDog`
    + `MjBweDsKICAgICAgICB6LWluZGV4OiA4MDsKICAgIH0KCiAgICAjTmV3VmVyc2lvblJlY29tbWVu`
    + `ZCAjY2xlYXJCdG4gewogICAgICAgIGRpc3BsYXk6IGJsb2NrOwogICAgICAgIHBvc2l0aW9uOiBh`
    + `YnNvbHV0ZTsKICAgICAgICBib3R0b206IDEwcHg7CiAgICAgICAgbGVmdDogMTM1cHg7CiAgICAg`
    + `ICAgei1pbmRleDogODA7CiAgICB9CgogICAgI05ld1ZlcnNpb25SZWNvbW1lbmQgI3ZlcnNpb25S`
    + `ZWNjb21tZW5kIHsKICAgICAgICB3aWR0aDogMTAwJTsKICAgICAgICBoZWlnaHQ6IDEwMCU7CiAg`
    + `ICAgICAgcG9zaXRpb246IGFic29sdXRlOwogICAgICAgIHRvcDogMDsKICAgICAgICBsZWZ0OiAw`
    + `OwogICAgICAgIGZvbnQtc2l6ZTogMzBweDsKICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7CiAg`
    + `ICAgICAgei1pbmRleDogMjA7CiAgICB9CgogICAgI05ld1ZlcnNpb25SZWNvbW1lbmQgI3ZlcnNp`
    + `b25SZWNjb21tZW5kIC52ZXJzaW9uUmVjY29tbWVuZFR4dCB7CiAgICAgICAgd2lkdGg6IDEwMCU7`
    + `CiAgICAgICAgbWFyZ2luOiAwIGF1dG87CiAgICAgICAgZGlzcGxheTogYmxvY2s7CiAgICAgICAg`
    + `cG9zaXRpb246IGFic29sdXRlOwogICAgICAgIHRvcDogLXdlYmtpdC1jYWxjKDUwJSArIDEwNXB4`
    + `KTsKICAgICAgICBsZWZ0OiAwOwogICAgICAgIGZvbnQtc2l6ZTogMjBweDsKICAgICAgICB0ZXh0`
    + `LWFsaWduOiBjZW50ZXI7CiAgICAgICAgdGV4dC1zaGFkb3c6IDJweCAwIDJweCAjZmZmLCAtMnB4`
    + `IDAgMnB4ICNmZmYsIDAgMnB4IDJweCAjZmZmLCAwIC0ycHggMnB4ICNmZmYsIDJweCAycHggMnB4`
    + `ICNmZmYsIC0ycHggMnB4IDJweCAjZmZmLCAycHggLTJweCAycHggI2ZmZiwgLTJweCAtMnB4IDJw`
    + `eCAjZmZmOwogICAgICAgIHotaW5kZXg6IDEwOwogICAgfQoKICAgICNOZXdWZXJzaW9uUmVjb21t`
    + `ZW5kICN2ZXJzaW9uUmVjY29tbWVuZCAudmVyc2lvblJlY2NvbW1lbmRUeHQwMiB7CiAgICAgICAg`
    + `d2lkdGg6IDEwMCU7CiAgICAgICAgbWFyZ2luOiAwIGF1dG87CiAgICAgICAgZGlzcGxheTogYmxv`
    + `Y2s7CiAgICAgICAgcG9zaXRpb246IGFic29sdXRlOwogICAgICAgIHRvcDogLXdlYmtpdC1jYWxj`
    + `KDUwJSArIDE0MHB4KTsKICAgICAgICBsZWZ0OiAwOwogICAgICAgIGZvbnQtc2l6ZTogMTZweDsK`
    + `ICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7CiAgICAgICAgdGV4dC1zaGFkb3c6IDJweCAwIDJw`
    + `eCAjZmZmLCAtMnB4IDAgMnB4ICNmZmYsIDAgMnB4IDJweCAjZmZmLCAwIC0ycHggMnB4ICNmZmYs`
    + `IDJweCAycHggMnB4ICNmZmYsIC0ycHggMnB4IDJweCAjZmZmLCAycHggLTJweCAycHggI2ZmZiwg`
    + `LTJweCAtMnB4IDJweCAjZmZmOwogICAgICAgIHotaW5kZXg6IDEwOwogICAgfQoKICAgICNOZXdW`
    + `ZXJzaW9uUmVjb21tZW5kICN2ZXJzaW9uUmVjY29tbWVuZCAjdmVyVXBCdG4gewogICAgICAgIHdp`
    + `ZHRoOiAyMzBweDsKICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7CiAgICAgICAgdG9wOiAtd2Vi`
    + `a2l0LWNhbGMoNTAlICsgMjA0cHgpOwogICAgICAgIGxlZnQ6IC13ZWJraXQtY2FsYyg1MCUgLSAx`
    + `MTVweCk7CiAgICAgICAgei1pbmRleDogNTA7CiAgICAgICAgYmFja2dyb3VuZDogdXJsKCIvbWFn`
    + `aWNhL3Jlc291cmNlL2ltYWdlX3dlYi9jb21tb24vYnRuL2J0bl9waW5rX2MucG5nIikgY2VudGVy`
    + `IHRvcCBuby1yZXBlYXQ7CiAgICAgICAgYmFja2dyb3VuZC1zaXplOiAtd2Via2l0LWNhbGMoMTAw`
    + `JSAtIDY2cHgpIDY0cHg7CiAgICB9CgogICAgI05ld1ZlcnNpb25SZWNvbW1lbmQgI3ZlcnNpb25S`
    + `ZWNjb21tZW5kICN2ZXJVcEJ0biwKICAgICNOZXdWZXJzaW9uUmVjb21tZW5kICN2ZXJzaW9uUmVj`
    + `Y29tbWVuZCAjdmVyVXBCdG4gc3BhbiB7CiAgICAgICAgY29sb3I6ICNmZmY7CiAgICAgICAgdGV4`
    + `dC1zaGFkb3c6IC0xcHggLTFweCAycHggI2ZmNWU3YywgMXB4IC0xcHggMnB4ICNmZjVlN2MsIC0x`
    + `cHggMXB4IDJweCAjZmY1ZTdjLCAxcHggMXB4IDJweCAjZmY1ZTdjLCAtMXB4IC0xcHggMnB4ICNm`
    + `ZjVlN2MsIDFweCAtMXB4IDJweCAjZmY1ZTdjLCAtMXB4IDFweCAycHggI2ZmNWU3YywgMXB4IDFw`
    + `eCAycHggI2ZmNWU3YzsKICAgIH0KCiAgICAjTmV3VmVyc2lvblJlY29tbWVuZCAjdmVyc2lvblJl`
    + `Y2NvbW1lbmQgI3ZlclVwQnRuOmJlZm9yZSB7CiAgICAgICAgYmFja2dyb3VuZDogdXJsKCIvbWFn`
    + `aWNhL3Jlc291cmNlL2ltYWdlX3dlYi9jb21tb24vYnRuL2J0bl9waW5rX2wucG5nIikgbGVmdCB0`
    + `b3Agbm8tcmVwZWF0OwogICAgfQoKICAgICNOZXdWZXJzaW9uUmVjb21tZW5kICN2ZXJzaW9uUmVj`
    + `Y29tbWVuZCAjdmVyVXBCdG46YWZ0ZXIgewogICAgICAgIGJhY2tncm91bmQ6IHVybCgiL21hZ2lj`
    + `YS9yZXNvdXJjZS9pbWFnZV93ZWIvY29tbW9uL2J0bi9idG5fcGlua19yLnBuZyIpIGxlZnQgdG9w`
    + `IG5vLXJlcGVhdDsKICAgIH0KCiAgICAjTmV3VmVyc2lvblJlY29tbWVuZCAjYXBwX3ZlciwKICAg`
    + `ICNOZXdWZXJzaW9uUmVjb21tZW5kICNhcHBfbmV3X3ZlciB7CiAgICAgICAgcG9zaXRpb246IGFi`
    + `c29sdXRlOwogICAgICAgIGxlZnQ6IDcwMHB4OwogICAgICAgIGZvbnQtc2l6ZTogMTRweDsKICAg`
    + `ICAgICBsaW5lLWhlaWdodDogMS4xOwogICAgICAgIHRleHQtYWxpZ246IGxlZnQ7CiAgICAgICAg`
    + `ei1pbmRleDogMjA7CiAgICB9CgogICAgI05ld1ZlcnNpb25SZWNvbW1lbmQgI2FwcF92ZXIgewog`
    + `ICAgICAgIGJvdHRvbTogMzBweDsKICAgIH0KCiAgICAjTmV3VmVyc2lvblJlY29tbWVuZCAjYXBw`
    + `X25ld192ZXIgewogICAgICAgIGJvdHRvbTogMTBweDsKICAgIH0KCiAgICAjTmV3VmVyc2lvblJl`
    + `Y29tbWVuZCAjY29udGFjdEJ0biB7CiAgICAgICAgcG9zaXRpb246IGFic29sdXRlOwogICAgICAg`
    + `IHJpZ2h0OiAxMHB4OwogICAgICAgIGJvdHRvbTogMTBweDsKICAgICAgICB6LWluZGV4OiA1MDA7`
    + `CiAgICB9CiAgICA8L3N0eWxlPgo8L2hlYWQ+Cgo8Ym9keSBjbGFzcz0iaW9zIj4KICAgIDxkaXYg`
    + `aWQ9InJlYWR5IiBjbGFzcz0iIj4uPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJkZWJ1ZyI+PC9kaXY+`
    + `CiAgICA8IS0tIOODreODvOODh+OCo+ODs+OCsCAtLT4KICAgIDxkaXYgaWQ9ImxvYWRpbmciIHN0`
    + `eWxlPSJkaXNwbGF5OiBub25lOyI+CiAgICAgICAgPHA+PC9wPgogICAgPC9kaXY+CiAgICA8ZGl2`
    + `IGlkPSJ0YXBCbG9jayIgc3R5bGU9IiI+PC9kaXY+CiAgICA8ZGl2IGlkPSJwb3B1cEFyZWEiPgog`
    + `ICAgICAgIDxkaXYgaWQ9InBvcHVwQ3VydGFpbiI+PC9kaXY+CiAgICA8L2Rpdj4KICAgIDxkaXYg`
    + `aWQ9Im92ZXJsYXBDb250YWluZXIiPgogICAgICAgIDxkaXYgaWQ9ImN1cnRhaW4iPjwvZGl2Pgog`
    + `ICAgPC9kaXY+CiAgICA8IS0tIEFuZHJvaWTjgIHjg53jg4Pjg5fjgqLjg4Pjg5fjgZfjgZ/mmYLj`
    + `ga7jgq/jg6rjg4Pjgq/lo4Hjga7ngrrjgasgLS0+CiAgICA8ZGl2IGlkPSJBbmRyb2lkTGlua1N0`
    + `b3AiPjwvZGl2PgogICAgPCEtLSDjgrPjg7Pjg4bjg7Pjg4TpoJjln58gLS0+CiAgICA8ZGl2IGlk`
    + `PSJiYXNlQ29udGFpbmVyIiBjbGFzcz0iZmFkZWluIj4KICAgICAgICA8ZGl2IGlkPSJ0dXRvcmlh`
    + `bENvbnRhaW5lciI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImJnV3JhcCI+PC9kaXY+CiAgICAg`
    + `ICAgICAgIDxkaXYgY2xhc3M9Im92ZXJsYXlXcmFwIj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBj`
    + `bGFzcz0iYXJyb3dXcmFwIj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iYXJyb3cyV3Jh`
    + `cCI+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9InRleHRXcmFwIj48L2Rpdj4KICAgICAg`
    + `ICA8L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJtYWluQ29udGVudCI+CiAgICAgICAgICAgIDxkaXY+`
    + `CiAgICAgICAgICAgICAgICA8ZGl2IGlkPSJOZXdWZXJzaW9uUmVjb21tZW5kIj4KICAgICAgICAg`
    + `ICAgICAgICAgICA8ZGl2PgogICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJsb2dv`
    + `Ij4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPSIvbWFnaWNhL3Jlc291cmNl`
    + `L2ltYWdlX3dlYi9jb21tb24vbG9nby9sb2dvLnBuZyIgYWx0PSIiPgoJCTwvZGl2PgogICAgICAg`
    + `ICAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD0idmVyc2lvblJlY2NvbW1lbmQiIGRhdGEtaHJl`
    + `Zj0iIj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz0idmVyc2lv`
    + `blJlY2NvbW1lbmRUeHQgY19wdXJwbGUiPuaWsOOBl+OBhOODkOODvOOCuOODp+ODs+OBjOOBguOC`
    + `iuOBvuOBmeOAguOCueODiOOCouOBp+acgOaWsOeJiOOCkuODgOOCpuODs+ODreODvOODieOBl+OB`
    + `puOBj+OBoOOBleOBhOOAgjwvc3Bhbj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8`
    + `c3BhbiBjbGFzcz0idmVyc2lvblJlY2NvbW1lbmRUeHQwMiBjX2dvbGQiPuOCueODiOOCouOBq+ac`
    + `gOaWsOeJiOOBjOWFrOmWi+OBleOCjOOBpuOBhOOBquOBhOWgtOWQiOOBr+aaq+OBj+OBiuW+heOB`
    + `oeOBj+OBoOOBleOBhOOAgjxicj4KCQkJ44Ki44OX44Oq44KS5YmK6Zmk44GX44Gm44GX44G+44GG`
    + `44Go44OH44O844K/44GM5Yid5pyf5YyW44GV44KM44Gm44GX44G+44GE44G+44GZ44Gu44Gn44GU`
    + `5rOo5oSP44GP44Gg44GV44GE44CCPC9zcGFuPgogICAgICAgICAgICAgICAgICAgICAgICAgICAg`
    + `PC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgICAg`
    + `IDwvZGl2PgogICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAg`
    + `IDwvZGl2Pgo8L2JvZHk+Cgo8L2h0bWw+`, 'base64');

const getRandomHex = (charCount: number): string => {
    return crypto.randomBytes(Math.trunc((charCount + 1) / 2)).toString('hex').substring(0, charCount);
}

const getRandomGuid = (): string => {
    return [8, 4, 4, 4, 12].map((len) => getRandomHex(len)).join("-");
}

const proxifiedConnect = () => new Promise<net.Socket>(async (resolve, reject) => {
    let socket = net.connect(1080, "127.0.0.1");
    let listener = (e: any) => { reject(e); };
    socket.on('error', listener);
    let read = () => new Promise<Buffer>((resolve) => {
        let listener = (data: Buffer) => { socket.off('data', listener); resolve(data); };
        socket.on('data', listener);
    });

    await new Promise<void>((resolve) => { socket.on('connect', () => { resolve(); }); });
    await new Promise<void>((resolve) => { socket.write(socksAuth, () => { resolve(); }); });
    let recv = await read();
    if (recv.byteLength != socksAuthSucceeded.byteLength || socksAuthSucceeded.compare(recv) != 0) {
        reject(new Error(`socks auth failed`));
        return;
    }
    await new Promise<void>((resolve) => { socket.write(socksConnect, () => { resolve(); }) });
    recv = await read();
    if (recv.byteLength != 10 || socksConnectSucceeded.compare(recv.subarray(0, 4)) != 0) {
        reject(new Error(`socks connect failed recv.byteLength=${recv.byteLength} [${recv.toString('hex')}]`));
        return;
    }
    console.log(`socks connected`);
    socket.off('error', listener);
    resolve(socket);
});

const connectHttp2 = () => new Promise<http2.ClientHttp2Session>(async (resolve, reject) => {
    //const socksfied = await proxifiedConnect();
    const secureSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const socket = tls.connect({
            //socket: socksfied,
            host: domain,
            port: 443,
            ALPNProtocols: ["h2"],
            servername: domain,
        });
        const listener = (e: any) => { reject(e); };
        socket.on('error', listener);
        socket.on('secureConnect', () => {
            socket.off('error', listener);
            resolve(socket);
        });
    });
    let listener = (e: any) => { reject(e); };
    http2.connect(authority, {
        ca: cacerts,
        createConnection: () => secureSocket,
    }, (session) => {
        session.off('error', listener);
        console.log(`http2 connected`);
        resolve(session);
    }).on('error', listener);
});

type assetListEntry = {
    file_list: Array<{
        size: number,
        url: string,
    }>,
    md5: string,
    model?: string,
    path: string,
}

export const jpfetch = async (): Promise<number> => {
    const StoryCollection = readBurpXml("StoryCollection-20240726-2.xml");
    const TopPage = readBurpXml("TopPage-20240726-2.xml");
    const MyPage = readBurpXml("MyPage-20240726.xml");
    const CharaCollection = readBurpXml('CharaCollection-20240727.xml');


    const maxConcurrent = 10;

    const randomGuid = getRandomGuid();

    const FAKE_INDEX_PAGE_RETURNED = `fake index page returned`;
    const compressableExts = new Set([
        "html",
        "css",
        "js",
        "json",
    ]);

    let client: http2.ClientHttp2Session | undefined = await connectHttp2();
    let isReconnecting = false;

    const gotSet = new Set<string>();
    const webResSet = new Set<string>();
    const allFileMap = new Map<string, string>();
    const manuallyHandledSet = new Set<string>();
    const manuallyHandledFailedSet = new Set<string>();

    const getRespHeaders = async (req: http2.ClientHttp2Stream): Promise<http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader> =>
        new Promise<http2.IncomingHttpHeaders & http2.IncomingHttpStatusHeader>((resolve, reject) => {
            const listener = (e: any) => reject(e);
            req.on('error', listener);
            req.on('response', (headers) => {
                req.off('error', listener);
                resolve(headers);
            })
        })

    const get = async (subPath: string, fetchAndUpdateEvenIfFileExist: boolean = true, isFragment: boolean = false): Promise<Buffer> => {
        const method = http2.constants.HTTP2_METHOD_GET;
        const host = domain;
        const fullPath = subPath.startsWith("/magica/") ? subPath : `/magica/${subPath}`;

        console.log(`PENDING ${method} ${fullPath} ...`);

        const reqHeaders: http2.OutgoingHttpHeaders = {
            [http2.constants.HTTP2_HEADER_METHOD]: method,
            [http2.constants.HTTP2_HEADER_PATH]: fullPath,
            [http2.constants.HTTP2_HEADER_HOST]: host,
        }

        if (subPath === "index.html") {
            reqHeaders["User-Id-Fba9x88mae"] = randomGuid;
        }

        if (subPath.startsWith("resource/download/asset/master/")) {
            reqHeaders["X-Platform-Host"] = `com.aniplex.magireco`;
            reqHeaders["User-Id-Fba9x88mae"] = randomGuid;
        } else {
            reqHeaders[http2.constants.HTTP2_HEADER_USER_AGENT] = `Mozilla/5.0 (Linux; Android 12; 22021211RC Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36`;
            reqHeaders[http2.constants.HTTP2_HEADER_ACCEPT] = "*/*";
            reqHeaders[http2.constants.HTTP2_HEADER_REFERER] = `https://${host}/magica/index.html`;
            reqHeaders[http2.constants.HTTP2_HEADER_ACCEPT_LANGUAGE] = `zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7`;
            reqHeaders["X-Requested-With"] = `com.aniplex.magireco`;
        }

        const extMatched = subPath.match(/\.[^.]+$/);
        if (!subPath.startsWith(`resource/download/asset/master/resource/`) && extMatched != null && compressableExts.has(extMatched[0])) {
            reqHeaders[http2.constants.HTTP2_HEADER_ACCEPT_ENCODING] = "gzip, deflate";
        }

        const fullfspath = path.join(outdir, fullPath);
        if (fullfspath.endsWith('.gz')) {
            const fullfspathNoGz = fullfspath.replace(/\.gz$/, "");
            if (fs.existsSync(fullfspathNoGz) && fs.statSync(fullfspathNoGz).isFile()) {
                if (allFileMap.has(fullPath.replace(/\.gz$/, ""))) throw new Error(`NoGz version indeed exists`);
                fs.unlinkSync(fullfspathNoGz);
            }
        }

        let existing: Buffer | undefined;
        let md5: string | undefined;
        if (fs.existsSync(fullfspath) && fs.statSync(fullfspath).isFile()) {
            existing = fs.readFileSync(fullfspath);
            if (!fetchAndUpdateEvenIfFileExist) {
                console.log(`${method} ${fullPath} (not fetching!)`);
                if (!isFragment) webResSet.add(fullPath);
                return existing;
            }
            md5 = crypto.createHash('md5').update(existing).digest().toString('hex');
            reqHeaders[http2.constants.HTTP2_HEADER_IF_NONE_MATCH] = `"${md5}"`;
        }

        if (client == null) {
            if (!isReconnecting) {
                isReconnecting = true;
                console.log(`reconnecting http2 ...`);
                client = await connectHttp2();
                isReconnecting = false;
            } else {
                while (isReconnecting || client == null) await new Promise<void>((r) => setTimeout(() => r(), 25));
            }
        }
        let req = client.request(reqHeaders);
        let respHeaders = await getRespHeaders(req);

        let status = respHeaders[":status"];
        if (status == 304) {
            console.log(`${method} ${fullPath} ${status} Not Modified`);
            if (existing == null) throw new Error(`existing == null`);
            if (!isFragment) webResSet.add(fullPath);
            return existing;
        } else if (status == 503) {
            // retry
            req = client.request(reqHeaders);
            respHeaders = await getRespHeaders(req);
        } else if (status != 200) {
            throw new Error(`[${fullPath}] status [${status}] not 304 503 or 200`);
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk) => { chunks.push(chunk); });

        await new Promise<void>((resolve, reject) => {
            const listener = (e: any) => reject(e);
            req.on('error', listener);
            req.on('end', () => {
                req.off('error', listener);
                resolve();
            });
        });

        req.destroy();

        let data = Buffer.concat(chunks);

        const compression = respHeaders[http2.constants.HTTP2_HEADER_CONTENT_ENCODING];
        if (typeof compression === 'string') switch (compression) {
            case "gzip": {
                if (!fullPath.endsWith('.gz')) {
                    console.log(`gunzip [${fullPath}]`);
                    data = zlib.gunzipSync(data);
                } else {
                    console.log(`keep [${fullPath}] as-is`);
                }
                break;
            }
            default: throw new Error(`unknown compression [${compression}]`);
        }

        if (data.byteLength == index404.byteLength && index404.compare(data) == 0) {
            console.error(`${method} ${fullPath} failed`);
            throw new Error(FAKE_INDEX_PAGE_RETURNED);
        }


        const dirname = path.dirname(fullfspath);
        let write = !isFragment;
        if (data.byteLength == existing?.byteLength && existing.compare(data) == 0) {
            write = false;
        }
        if (write) {
            if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
            fs.writeFileSync(fullfspath, data);
            gotSet.add(fullfspath);
        }
        if (!isFragment) {
            if (md5 == null) md5 = crypto.createHash('md5').update(data).digest().toString('hex');
            allFileMap.set(fullPath, md5);
            webResSet.add(fullPath);
        }

        console.log(`${method} ${fullPath} ${status} OK, got ${data.byteLength} bytes${write ? "" : isFragment ? "(not written)" : " (not modified)"}`);

        return data;
    }

    const getAssetEntry = async (entry: assetListEntry): Promise<Buffer> => {
        const highLow = entry.file_list[0].url.replace(/^movie\/char\/(high|low)\/movie.*$/, "$1");
        const fullPath = `/magica/resource/${entry.path.replace(/^(movie\/char\/)(movie)/, `$1${highLow}/$2`)}`;
        const fullfspath = path.join(outdir, fullPath);
        if (fs.existsSync(fullfspath) && fs.statSync(fullfspath).isFile()) {
            const existing = fs.readFileSync(fullfspath);
            const existingMD5 = crypto.createHash('md5').update(existing).digest().toString('hex');
            if (existingMD5 === entry.md5) {
                console.log(`getAssetEntry ${fullPath} MD5 matches, skipped`);
                allFileMap.set(fullPath, existingMD5);
                return existing;
            }
        }
        const data = Buffer.concat(await Promise.all((entry.file_list.map((f) => get(`resource/download/asset/master/resource/${f.url}`, true, true)))));
        const totalSize = entry.file_list.reduce((prev, cur) => prev + cur.size, 0);
        if (totalSize != data.byteLength) {
            console.error(`[${fullPath}] unexpected byteLength, expected ${totalSize} vs actual ${data.byteLength}`);
            console.error(`[${data.toString('utf-8')}]`);
            throw new Error(`unexpected byteLength`);
        }
        const md5 = crypto.createHash('md5').update(data).digest().toString('hex');
        if (md5 !== entry.md5) {
            console.error(`[${fullPath}] md5 mismatch, expected ${entry.md5} vs actual ${md5}`);
            console.error(`[${data.toString('utf-8')}]`);
            throw new Error(`md5 mismatch`);
        }
        const dirname = path.dirname(fullfspath);
        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
        fs.writeFileSync(fullfspath, data);
        console.log(`getAssetEntry ${fullPath} written`);
        allFileMap.set(fullPath, md5);
        return data;
    }

    const downloadAssetEntries = async (entries: assetListEntry[]): Promise<void> => {
        while (entries.length > 0) {
            let tasks: assetListEntry[] = [];
            for (let i = 0; i < maxConcurrent; i++) {
                let shifted = entries.shift();
                if (shifted == null) break;
                if (shifted.file_list.length == 0) throw new Error(`shifted.file_list.length == 0`);
                i += shifted.file_list.length - 1;
                tasks.push(shifted);
            }
            await Promise.all(tasks.map((entry) => getAssetEntry(entry)));
        }
    }


    const fetchAssets = async () => {
        // (1) downloaded assets
        const assetJsonNames = [
            "char_list",
            "main",
            "voice",
            "fullvoice",
            "movie_high",
            "movie_low",
            "movieall_high",
            "movieall_low",
        ];
        const assetJsons: assetListEntry[][] = (await Promise.all(assetJsonNames.map((name) => get(`resource/download/asset/master/asset_${name}.json.gz`))))
            .map((gz) => zlib.gunzipSync(gz))
            .map((data) => JSON.parse(data.toString('utf-8')));
        for (let json of assetJsons) {
            await downloadAssetEntries(json);
        }
    }


    const fetchWebRes = async () => {
        // (2) web resources
        const unresolvedImgPathMap = new Map<string, string>();
        const errImgPathMap = new Map<string, string>();

        const indexHtml = (await get(`index.html`)).toString('utf-8');

        const replacementJs = (await get(`js/system/replacement.js`)).toString('utf-8');
        const fileTimeStampLine = replacementJs.split('\n').find((s) => s.includes(`fileTimeStamp`));
        if (fileTimeStampLine == null) throw new Error(`fileTimeStamp not found`);
        const fileList = new Set(Object.keys(JSON.parse(fileTimeStampLine.replace(/^.+{/, '{').replace(',};', '}'))));


        const manual = async () => {
            // manual supplements
            const manualDownloadSet = new Set<string>();

            manualDownloadSet.add(`/magica/resource/image_web/page/quest/puellaHistoria_lastBattle/event/1198/event_pop.png`); // pillar of tomorrow
            ["eventStoryList", "regularEventList"].forEach((key) => StoryCollection[key].forEach((event: any) => {
                let eventId: number = event.eventId || event.regularEventId;
                let eventType: string = event.eventType || event.regularEventType;
                const addEventPopup = (typeInUrl: string) => manualDownloadSet.add(`/magica/resource/image_web/event/${typeInUrl}/${eventId}/event_pop.png`);
                switch (eventType) {
                    // GlobalMenuView
                    case 'WITCH': {
                        addEventPopup('eventWitch');
                        break;
                    }
                    case 'ARENAMISSION': {
                        addEventPopup('arenaMission');
                        break;
                    }
                    case 'DAILYTOWER':
                    case 'BRANCH':
                    case 'SINGLERAID':
                    case 'DUNGEON':
                    case 'ACCOMPLISH':
                    case 'RAID':
                    case 'TOWER': {
                        addEventPopup((eventType as string).toLowerCase());
                        break;
                    }
                }
                switch (eventType) {
                    case 'ACCOMPLISH': {
                        // EventAccomplishTop.js
                        manualDownloadSet.add(`/magica/resource/image_web/event/accomplish/${eventId}/reward_list.png`);
                        // EventAccomplishTop.html
                        [
                            `/magica/resource/image_web/event/accomplish/${eventId}/title_story.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/bg_quest_n.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/title_challenge.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/bg_quest_c.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/bg_quest_boss.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/icon_boss.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/bg_current_num_n.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/bg_current_num_c.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_0.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_1.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_2.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_3.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_4.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_5.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_6.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_7.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_8.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_n_9.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_0.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_1.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_2.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_3.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_4.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_5.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_6.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_7.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_8.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/current_num_c_9.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/progress_gauge_n_t.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/progress_gauge_n_b.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/progress_gauge_n_c.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/progress_gauge_c_t.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/progress_gauge_c_b.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/progress_gauge_c_c.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/icon_complete.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/logo.png`,
                            `/magica/resource/image_web/item/event/event_accomplish_${eventId}_exchange_1.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/reward_header.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/reward_list.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/accomplish/${eventId}/navi_03.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                    case 'SINGLERAID': {
                        // EventSingleRaidTop.html
                        // EventSingleRaidSelect.html
                        [
                            `/magica/resource/image_web/event/singleraid/${eventId}>/item_bar_bg.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/item_gauge_01.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/item_gauge_03.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/item_gauge_02.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/quest/boss_hp.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/quest/boss_gauge_l.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/quest/boss_gauge_r.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/quest/boss_gauge_c.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}>/bg_footer.png`,
                            `/magica/resource/image_web/item/event/event_singleraid_${eventId}_exchange_1.png`,
                            `/magica/resource/image_web/item/event/event_singleraid_${eventId}_exchange_2.png`,
                            `/magica/resource/image_web/item/event/event_singleraid_${eventId}_exchange_3.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}/quest/memoria_equip.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/singleraid/${eventId}/navi_03.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        for (let i = 1; i <= 3; i++) manualDownloadSet.add(`/magica/resource/image_web/item/event/event_singleraid_${eventId}_exchange_${i}.png`);
                        break;
                    }
                    case 'DAILYTOWER': {
                        // EventDailyTowerTop.html
                        manualDownloadSet.add(`/magica/resource/image_web/event/dailytower/${eventId}/logo.png`);
                        [
                            `/magica/resource/image_web/item/event/event_dailytower_${eventId}_exchange_1.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_normal_off.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_normal_on.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_challenge_off.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_challenge_on.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_exchallenge_off.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_exchallenge_on.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_endlesschallenge_off.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/tab_endlesschallenge_on.png`,
                            `/magica/resource/image_web/item/event/event_dailytower_${eventId}_key.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/bg_quest_n.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/bg_quest_c.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/bg_quest_ex.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/bg_quest_e.png`,
                            `/magica/resource/image_web/common/icon/event/icon_event_dailytower_${eventId}_key_f.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/navi_03.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/navi_04.png`,
                            `/magica/resource/image_web/event/dailytower/${eventId}/navi_05.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        for (let i = 3; i <= 4; i++) manualDownloadSet.add(`/magica/resource/image_web/event/dailytower/common/schedule_header_${i}.png`);
                        break;
                    }
                    case 'TRAINING': {
                        // EventTrainingCharaSelect.html, not promising
                        [
                            `/magica/resource/image_web/event/training/${eventId}/logo.png`,
                            `/magica/resource/image_web/event/training/${eventId}/event_pop.png`,
                            `/magica/resource/image_web/event/training/${eventId}/quest_title_chara.png`,
                            `/magica/resource/image_web/event/training/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/training/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/training/${eventId}/navi_03.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                    case 'BRANCH': {
                        [
                            `/magica/resource/image_web/event/branch/${eventId}/icon_part_01.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/icon_part_02.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/btn_chapter_02.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/btn_chapter_01.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/top_title_bg_01.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/logo.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/navi_03.png`,
                            `/magica/resource/image_web/event/branch/${eventId}/navi_04_a.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                    case 'TOWER': {
                        [
                            `/magica/resource/image_web/event/tower/${eventId}/logo.png`,
                            `/magica/resource/image_web/item/event/event_tower_${eventId}_exchange_1.png`,
                            `/magica/resource/image_web/item/event/event_tower_${eventId}_key.png`,
                            `/magica/resource/image_web/event/tower/${eventId}/bg_quest_n.png`,
                            `/magica/resource/image_web/event/tower/${eventId}/bg_quest_c.png`,
                            `/magica/resource/image_web/common/icon/event/icon_event_tower_${eventId}_key_f.png`,
                            `/magica/resource/image_web/event/tower/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/tower/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/tower/${eventId}/navi_03.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                    case 'DUNGEON': {
                        [
                            `/magica/resource/image_web/event/dungeon/${eventId}/logo.png`,
                            `magica/resource/image_web/item/event/event_dungeon_${eventId}_cure_cp.png`,
                            `magica/resource/image_web/item/event/event_dungeon_${eventId}_exchange_1.png`,
                            `/magica/resource/image_web/event/dungeon/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/event/dungeon/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/event/dungeon/${eventId}/navi_03.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                    case 'WITCH': {
                        // template/event/EventWitch/parts/IconCharaGauge.html
                        let event = StoryCollection.eventStoryList.find((event: any) => event.eventId == eventId);
                        let charaIdList: number[] = event.storyList.filter((entry: any) => !entry.storyIds.endsWith('-0')).map((entry: any) => {
                            let found = MyPage.userCardList.find((c: any) => c.card.cardName === entry.storyTitle);
                            if (found) return found.card.cardNo;
                            found = CharaCollection.charaList.find((c: any) => c.chara?.name === entry.storyTitle);
                            if (found) return found.charaId;
                            else throw Error(`cannot find charaId for [${entry.storyTitle}]`);
                        });
                        for (let charaId of charaIdList) {
                            [
                                `/magica/resource/image_web/event/eventWitch/${eventId}/chara/gauge_chara_${charaId}00.png`,
                                `/magica/resource/image_web/event/eventWitch/${eventId}/navi_01.png`,
                                `/magica/resource/image_web/event/eventWitch/${eventId}/navi_02.png`,
                                `/magica/resource/image_web/event/eventWitch/${eventId}/navi_03.png`,
                                `/magica/resource/image_web/event/eventWitch/${eventId}/navi_04.png`,
                            ].forEach((url) => manualDownloadSet.add(url));
                        }
                        break;
                    }
                    case 'EXTERMINATION': {
                        [
                            `/magica/resource/image_web/regularEvent/extermination/${eventId}/logo.png`,
                            `/magica/resource/image_web/regularEvent/extermination/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/regularEvent/extermination/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/regularEvent/extermination/${eventId}/navi_03.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                    case 'GROUPBATTLE': {
                        [
                            `/magica/resource/image_web/regularEvent/groupBattle/${eventId}/navi_01.png`,
                            `/magica/resource/image_web/regularEvent/groupBattle/${eventId}/navi_02.png`,
                            `/magica/resource/image_web/regularEvent/groupBattle/${eventId}/navi_03.png`,
                            `/magica/resource/image_web/regularEvent/groupBattle/${eventId}/navi_04.png`,
                            `/magica/resource/image_web/regularEvent/groupBattle/${eventId}/navi_05.png`,
                        ].forEach((url) => manualDownloadSet.add(url));
                        break;
                    }
                }
            }));
            // MirrorPartsView.js
            manualDownloadSet.add(`/magica/resource/image_web/page/quest/puellaHistoria/top/synopsis_s_11.png`);
            // PatrolTop.html
            for (let i = 1; i <= 3; i++) manualDownloadSet.add(`/magica/resource/image_web/page/patrol/map/map${i}.png`);
            // ItemImgView.html
            StoryCollection.campaignStoryList.forEach((campaign: any) => {
                let campaignId = campaign.campaignId;
                [
                    `/magica/resource/image_web/common/icon/campaign/icon_campaign_${campaignId}_exchange_f.png`,
                    `/magica/resource/image_web/item/main/campaign_${campaignId}_exchange.png`,
                ].forEach((url) => manualDownloadSet.add(url));
                if (campaign.campaignType === 'MISSION_STORY') {
                    [
                        `/magica/resource/image_web/campaign/mission_story/${campaignId}/bg_date_tx.png`,
                        `/magica/resource/image_web/campaign/mission_story/${campaignId}/logo.png`,
                        `/magica/resource/image_web/campaign/mission_story/${campaignId}/btn_mission.png`,
                        `/magica/resource/image_web/campaign/mission_story/${campaignId}/bg_tx.png`,
                        `/magica/resource/image_web/campaign/mission_story/${campaignId}/btn_list.png`,
                    ].forEach((url) => manualDownloadSet.add(url));
                }
            });
            // home_ev_xxxx_xxxxx.png like home_ev_1099_12074.png, item icon of home wallpapers!
            const mainAssetJson: assetListEntry[] = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(outdir, "magica/resource/download/asset/master/asset_main.json.gz"))).toString('utf-8'));
            const wallpaperIds = new Set<string>();
            mainAssetJson.forEach((entry) => {
                let matched = entry.path.match(/^image_native\/bg\/web\/web_ev_\d{4}_\d{5}/);
                if (matched) wallpaperIds.add(matched[0].replace(/^image_native\/bg\/web\/web_ev_/, ""));
            });
            if (wallpaperIds.size == 0) throw new Error(`wallpaperIds.size == 0`);
            wallpaperIds.forEach((wallpaperId) => manualDownloadSet.add(`/magica/resource/image_web/item/main/home_ev_${wallpaperId}.png`));
            // titles
            const titleBaseImageList = [
                'title_21001',
                'title_21002',
                'title_22001',
                'title_35001',
                'title_39001',
                'title_32001',
                'title_31001',
                'title_33001',
                'title_34001',
                'title_36001',
                'title_11002',
                'title_11003',
                'title_64003',
                'title_64002',
                'title_64001',
                'title_65003',
                'title_65002',
                'title_65001',
                'title_66003',
                'title_66002',
                'title_66001',
                'title_67003',
                'title_67002',
                'title_67001',
                'title_68003',
                'title_68002',
                'title_68001',
                'title_10003',
                'title_69003',
                'title_69002',
                'title_69001',
                'title_610003',
                'title_610002',
                'title_610001',
                'title_611003',
                'title_611002',
                'title_611001',
                'title_612003',
                'title_612002',
                'title_612001',
                'title_613003',
                'title_613002',
                'title_613001',
                'title_614003',
                'title_614002',
                'title_614001',
                'title_615003',
                'title_615002',
                'title_615001',
                'title_34003',
            ];
            for (let img of titleBaseImageList) {
                manualDownloadSet.add(`/magica/resource/image_web/common/grade/${img}.png`);
            }
            // template/event/EventArenaRankMatch/Result.html
            for (let i = 0; i <= 10; i++) {
                manualDownloadSet.add(`/magica/resource/image_web/event/arenaRankMatch/common/result/numbers/num_rankup_${i}.png`);
            }
            // template/quest/puellaHistoria/lastBattle/QuestResultSubBoss.html
            for (let u of ["event/eventWalpurgis", "page/quest/puellaHistoria_lastBattle"]) {
                for (let j of ["p", "y"]) {
                    for (let i = 0; i <= 9; i++) {
                        manualDownloadSet.add(`/magica/resource/image_web/${u}/result/_number/${j}_num_${i}.png`);
                    }
                    manualDownloadSet.add(`/magica/resource/image_web/${u}/result/_number/${j}_num_comma.png`);
                }
            }
            // GachaHistory.html
            for (let gachaId = 0; gachaId <= 3000; gachaId++) {
                let gachaIdStr = String(gachaId).padStart(4, '0');
                manualDownloadSet.add(`/magica/resource/image_web/banner/gacha/gachabanner_${gachaIdStr}_m.png`);
            }
            // stickers
            const ItemListTop = readBurpXml('ItemListTop-20240727.xml');
            const stickerIdList = ItemListTop.userItemList.filter((item: any) => item.itemId.includes('STICKER')).map((item: any) => item.itemId.toLowerCase());
            if (stickerIdList.length != 228) throw new Error(`stickerIdList.length ${stickerIdList.length} != 228`);
            for (let size of ['s', 'l']) {
                for (let id of stickerIdList) manualDownloadSet.add(`/magica/resource/image_web/page/collection/sticker/${id}_${size}.png`);
            }
            // TutorialNavi.html
            for (let pos of ["l", "r"]) {
                manualDownloadSet.add(`/magica/resource/image_web/page/tutorial/popup/navi_arrow_${pos}.png`);
            }
            [
                `/magica/resource/image_web/regularEvent/accomplish/2037/navi_01.png`,
                `/magica/resource/image_web/regularEvent/accomplish/2037/navi_02.png`,
                `/magica/resource/image_web/page/quest/puellaHistoria_lastBattle/event/1198/navi_01.png`,
                `/magica/resource/image_web/page/quest/puellaHistoria_lastBattle/event/1198/navi_02.png`,
                `/magica/resource/image_web/page/quest/puellaHistoria_lastBattle/event/1198/navi_03.png`,
                `/magica/resource/image_web/page/quest/secondPartLast/navi_01.png`,
                `/magica/resource/image_web/page/quest/secondPartLast/navi_02.png`,
                `/magica/resource/image_web/event/eventWalpurgis/1217/navi_01.png`,
                `/magica/resource/image_web/event/eventWalpurgis/1217/navi_02.png`,
                `/magica/resource/image_web/event/eventWalpurgis/1217/navi_03.png`,
                `/magica/resource/image_web/page/quest/scene0/top/navi_01.png`,
                `/magica/resource/image_web/page/quest/scene0/top/navi_02_a.png`,
                `/magica/resource/image_web/page/quest/scene0/top/navi_03_a.png`,
            ].forEach((url) => manualDownloadSet.add(url));
            // RegularEventAccomplishTop.html
            const battleMuseumSectionIds: number[] = StoryCollection.userSectionList.filter((s: any) => s.section.questType === "REG_ACC").map((s: any) => Number(s.sectionId));
            if (battleMuseumSectionIds.length != 5) throw new Error(`battleMuseumSectionIds.length != 5`);
            const cardIds = battleMuseumSectionIds.map(
                (sectionId) => StoryCollection.userQuestBattleList
                    .map((entry: any) => entry.questBattle)
                    .find((questBattle: any) => questBattle.sectionId === sectionId && questBattle.parameterMap?.CARDID != null).parameterMap.CARDID
            );
            if (cardIds.length != 5) throw new Error(`cardIds.length != 5`);
            cardIds.forEach((cardId) => manualDownloadSet.add(`/magica/resource/image_web/regularEvent/accomplish/common/storychara/icon_stage_chara_${cardId}.png`));


            // the list is now ready, fetch all of them
            while (manualDownloadSet.size > 0) {
                let tasks: string[] = [];
                for (let i = 0; i < maxConcurrent; i++) {
                    let next = manualDownloadSet.keys().next();
                    if (next.done) break;
                    let value = next.value;
                    manualDownloadSet.delete(value);
                    tasks.push(value);
                }
                let results = await Promise.allSettled(tasks.map((f) => get(f)));
                let rejected = results.filter((result, index) => {
                    if (result.status === 'fulfilled') {
                        manuallyHandledSet.add(tasks[index]);
                        return false;
                    } else {
                        manuallyHandledFailedSet.add(tasks[index]);
                        return true;
                    }
                });
                if (rejected.length > 0) {
                    client?.destroy();
                    client = undefined;
                }
            }
        }
        await manual();


        while (fileList.size > 0) {
            let tasks: string[] = [];
            for (let i = 0; i < maxConcurrent; i++) {
                let next = fileList.keys().next();
                if (next.done) break;
                let value = next.value;
                fileList.delete(value);
                tasks.push(value);
            }
            let files = await Promise.all(tasks.map((f) => get(f)));

            let listener = (e: any) => { console.error(`http2 client error`, e); };
            client?.on('error', listener);
            let imgPathMap = new Map<string, string>();
            for (let i = 0; i < tasks.length; i++) {
                let subPath = tasks[i];
                const forEachFn = (s: string): void => {
                    if (s.includes("<%=") || s.includes("%>")) unresolvedImgPathMap.set(s, subPath);
                    else imgPathMap.set(s, subPath);
                };
                if (subPath.endsWith('.css') || subPath.endsWith('.html') || (subPath.endsWith('.js'))) {
                    let file = files[i].toString('utf-8');
                    let quoted = file.match(/("[^"\n]+"|'[^'\n]+')/g)?.map((s) => s.substring(1, s.length - 1));
                    quoted?.filter((s) => s.match(/.+\.(jpg|png|mp4|json)$/))
                        .filter((s) => !s.includes("text!"))
                        .forEach(forEachFn);
                    quoted?.filter((s) => s.includes("text!"))
                        .forEach((s) => s.split(" ").filter((s) => s.endsWith(".json")).map((s) => s.replace(/^text!/, "")).forEach(forEachFn));
                }
            }
            let imgPaths = Array.from(imgPathMap.keys());
            let fromPaths = Array.from(imgPathMap.values());
            let results = await Promise.allSettled(imgPaths.map((f) => get(f)));
            let rejected = results.filter((result, index) => {
                if (result.status === 'rejected') {
                    let s = imgPaths[index], subPath = fromPaths[index];
                    console.error(`rejected: [${s}] from[${subPath}]`, result.reason);
                    errImgPathMap.set(s, subPath);
                    return true;
                }
            });
            client?.off('error', listener);
            if (rejected.length > 0) {
                client?.destroy();
                client = undefined;
            }
        }


        const CNFileList = new Set(Object.keys(replacementCn.fileTimeStamp));
        for (let k of fileList) CNFileList.delete(k);
        while (CNFileList.size > 0) {
            let listener = (e: any) => { console.error(`http2 client error`, e); };
            client?.on('error', listener);

            let tasks: string[] = [];
            for (let i = 0; i < maxConcurrent; i++) {
                let next = CNFileList.keys().next();
                if (next.done) break;
                let value = next.value;
                CNFileList.delete(value);
                tasks.push(value);
            }
            let results = await Promise.allSettled(tasks.map((f) => get(f)));
            let rejected = results.filter((result, index) => {
                if (result.status === 'rejected') {
                    let s = tasks[index];
                    console.error(`rejected: [${s}] from cn version of replacement.js`, result.reason);
                    errImgPathMap.set(s, `replacement_cn.js`);
                    return true;
                }
            });

            client?.off('error', listener);
            if (rejected.length > 0) {
                client?.destroy();
                client = undefined;
            }
        }

        console.log(`unresolvedImgPathMap.size`, unresolvedImgPathMap.size);
        fs.writeFileSync(`unresolvedImgPaths.json`, JSON.stringify(Array.from(unresolvedImgPathMap.entries()), undefined, 2), 'utf-8');
        console.log(`errImgPathMap.size`, errImgPathMap.size);
        fs.writeFileSync(`errImgPaths.json`, JSON.stringify(Array.from(errImgPathMap.entries()), undefined, 2), 'utf-8');

        fs.writeFileSync(`manuallyHandledSet.json`, JSON.stringify(Array.from(manuallyHandledSet), undefined, 2), 'utf-8');
        console.log(`manuallyHandledSet.size = ${manuallyHandledSet.size}`);
        fs.writeFileSync(`manuallyHandledFailedSet.json`, JSON.stringify(Array.from(manuallyHandledFailedSet), undefined, 2), 'utf-8');
        console.log(`manuallyHandledFailedSet.size = ${manuallyHandledFailedSet.size}`);
        fs.writeFileSync(`webResSet.json`, JSON.stringify(Array.from(webResSet), undefined, 2), 'utf-8');
        console.log(`webResSet.size = ${webResSet.size}`);
    }


    // (3) stories
    const downloadedStoryIdSet = new Set<string>();
    const prefix = "/magica/resource/download/asset/master/";
    const downloadStory = async (storyId: string): Promise<void> => {
        const assetScenarioJson = JSON.parse(zlib.gunzipSync(await get(`${prefix}asset_scenario_${storyId}.json.gz`)).toString('utf-8'));
        await downloadAssetEntries(assetScenarioJson);
        downloadedStoryIdSet.add(storyId);
    }
    const downloadStories = async (storyIds: string[], ignoreErrors = false, failedSet?: Set<string>): Promise<void> => {
        while (storyIds.length > 0) {
            let tasks: string[] = [];
            for (let i = 0; i < maxConcurrent; i++) {
                let shifted = storyIds.shift();
                if (shifted == null) break;
                tasks.push(shifted);
            }
            if (ignoreErrors) {
                let results = await Promise.allSettled(tasks.map((storyId) => downloadStory(storyId)));
                let rejected = results.filter((result, index) => {
                    if (result.status === 'rejected') {
                        if (failedSet != null) {
                            failedSet.add(tasks[index]);
                        }
                        return true;
                    }
                });
                if (rejected.length > 0) {
                    client?.destroy();
                    client = undefined;
                }
            } else await Promise.all(tasks.map((storyId) => downloadStory(storyId)));
        }
    }
    const downloadSectionFiles = async (sectionOrEventId: number, isEvent: boolean): Promise<void> => {
        // download hca voices
        if (isNaN(sectionOrEventId)) throw new Error(`sectionOrEventId is NaN`);
        if (isEvent) {
            if (sectionOrEventId < 0 || sectionOrEventId > 9999) throw new Error(`eventId out of range`);
        } else if (sectionOrEventId < 0 || sectionOrEventId > 999999) throw new Error(`sectionId out of range`);
        const sectionIdStr = String(sectionOrEventId).padStart(isEvent ? 4 : 6, '0');
        const assetSectionJson = JSON.parse(zlib.gunzipSync(await get(`${prefix}asset_section${isEvent ? "_event" : ""}_${sectionIdStr}.json.gz`)).toString('utf-8'));
        await downloadAssetEntries(assetSectionJson);
    }
    const fetchStories = async () => {
        const enkanRecStoryIdSet = new Set(fs.readFileSync('EnkanRec-magireco-source-ls.txt', 'utf-8').split('\n')
            .filter((file) => file.endsWith('.json') && !file.startsWith('special-')).map((file) => file.replace(/\.json$/, "")));

        const mainAssetJson = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(outdir, "magica/resource/download/asset/master/asset_main.json.gz"))).toString('utf-8'));
        type section = Object & { secret?: string };
        const sectionIdMap = new Map<number, section>(
            // scene0 is not included in userSectionList
            StoryCollection.userSectionList.map((entry: any) => [Number(entry.sectionId), entry.section as Object])
        );
        type questBattle = Object & { startStory?: string, questStories?: string, endStory?: string };
        const getStoryIds = (questBattleSet: Set<questBattle>): Set<string> => {
            let storyIds = new Set<string>();
            ["startStory", "questStories", "endStory"].forEach((key) => {
                for (let questBattle of questBattleSet) {
                    (questBattle as any)[key]?.split(',').forEach((storyId: any) => storyIds.add(storyId));
                }
            });
            return storyIds;
        }
        const questBattleMap = new Map<number, Set<questBattle>>();
        const userQuestBattleStoryIdSet = new Set<string>();
        const scene0StoryIdSet = new Set<string>();
        StoryCollection.userQuestBattleList.map((entry: any) => entry.questBattle).forEach((questBattle: any) => {
            let naviWaves = questBattle.naviWaves;
            if (naviWaves != null) {
                let matched = naviWaves.match(/\d{6,7}-\d+(_[0-9a-zA-Z]{5}|)/g);
                if (matched) matched.forEach((storyId: any) => userQuestBattleStoryIdSet.add(storyId));
            }
            ["startStory", "questStories", "endStory", "sceneZeroStoryIds"].forEach((key) => {
                questBattle[key]?.split(",").forEach((storyId: any) => {
                    if (!storyId.startsWith('9')) {
                        // not scene0
                        // INCORRECT let sectionId = Number(storyId.match(/^\d{6,7}/)[0]); eg. storyId "101801-6" => "sectionId" 101851
                        let sectionId = questBattle.sectionId;
                        if (typeof sectionId !== 'number') throw new Error(`questBattle.sectionId not number`);
                        let questBattleSet = questBattleMap.get(sectionId);
                        if (questBattleSet == null) questBattleMap.set(sectionId, questBattleSet = new Set<Object & { secret?: string }>());
                        questBattleSet.add(questBattle);
                        let storyIdNoSecret = storyId.match(/^\d{6,7}-\d+/)[0];
                        let secret = sectionIdMap.get(sectionId)?.secret;
                        let storyIdWithSecretIfExist = `${storyIdNoSecret}${secret != null ? `_${secret}` : ""}`;
                        if (storyIdWithSecretIfExist !== storyId) {
                            if (sectionId == 102005) {
                                // chaotic secrets, no secret field in userSectionList
                                storyIdWithSecretIfExist = storyId;
                            } else {
                                if (secret == null) throw new Error(`no secret but [${storyIdWithSecretIfExist}] !== [${storyId}]`);
                                else if (!storyId.match(/^\d{6,7}-\d+$/)) throw new Error(`unexpected different secret ? ${storyIdWithSecretIfExist} !== [${storyId}]`);
                            }
                        }
                        userQuestBattleStoryIdSet.add(storyIdWithSecretIfExist);
                    } else {
                        // scene0
                        if (key !== "sceneZeroStoryIds") throw new Error(`storyId starts with 9 but it is not in sceneZeroStoryIds`);
                        scene0StoryIdSet.add(storyId);
                        userQuestBattleStoryIdSet.add(storyId);
                    }
                });
            });
        });

        const mainStory = async () => {
            // arc 1 prologue
            const arc1PrologueStoryIds = "000001-1 000002-1 000003-1 000003-2 000003-3 000003-4 000003-5".split(' ');
            const arc1PrologueSectionIds = Array.from(new Set(arc1PrologueStoryIds.map((storyId) => Number(storyId.match(/^\d{6,7}/)))));
            await downloadStories(arc1PrologueStoryIds);
            await Promise.all(arc1PrologueSectionIds.map((sectionId) => downloadSectionFiles(sectionId, false)));

            // main story, puella historia Present-day Kamihama, another story
            for (let sectionIdStart of [10, 20]) {
                let start = sectionIdStart == 10 ? 11 : 52;
                let end = sectionIdStart == 10 ? 34 : 81;
                for (let genericId = start; genericId <= end; genericId++) {
                    if (sectionIdStart == 20) {
                        if (genericId > 60 && genericId < 71) continue;
                    }
                    for (let genericIndex = 1; genericIndex <= 99; genericIndex++) {
                        let sectionId = Number(`${sectionIdStart}${genericId}${String(genericIndex).padStart(2, '0')}`);
                        let questBattleSet = questBattleMap.get(sectionId);
                        if (questBattleSet == null) continue;
                        let storyIdSet = getStoryIds(questBattleSet);
                        let storyIdList = Array.from(storyIdSet).map((storyId) => {
                            let secret = sectionIdMap.get(sectionId)?.secret;
                            if (secret != null) storyId += `_${secret}`;
                            return storyId;
                        });
                        await downloadStories(storyIdList);
                        // asset_section_xxxxxx.json, only main story
                        if (sectionIdStart == 10 && genericId <= 33) try {
                            await downloadSectionFiles(sectionId, false);
                        } catch (e) {
                            console.error(`await downloadSectionFiles() sectionId = [${sectionId}]`, e);
                            if (sectionIdMap.has(sectionId)) throw new Error(`sectionId = ${sectionId} download failed`);
                        }
                    } // section
                } // chapter
            } // main or another
        }

        const eventStory = async () => {
            // puella historia except Present-day Kamihama, event stories, special (campaign) stories
            const eventStoryIdSet = new Set<string>();
            ["puellaStoryList", "eventStoryList", "campaignStoryList"].map((key) => StoryCollection[key])
                .forEach((eventList) => eventList.forEach((event: any) => event.storyList.forEach((entry: any) => entry.storyIds.split(',').forEach((storyId: any) => {
                    eventStoryIdSet.add(storyId);
                }))));
            await downloadStories(Array.from(eventStoryIdSet));
            // asset_section_event_xxxx.json
            const voicedEventSectionIds = StoryCollection.eventStoryList.filter((event: any) => event.existsVoice)
                .map((event: any) => Number(event.eventId));
            for (let eventId of voicedEventSectionIds) {
                await downloadSectionFiles(eventId, true);
            }
        }

        const mirrorsStory = async () => {
            // mirrors
            const mirrorsStoryIdList: string[] = StoryCollection.arenaBattleFreeRankClassList.map((entry: any) => entry.storyId);
            await downloadStories(mirrorsStoryIdList);

            // battle museum is buried in userSectionList and userQuestBattleList
            await downloadStory("420131-0"); // prologue
            const battleMuseumSectionIds: number[] = StoryCollection.userSectionList.filter((s: any) => s.section.questType === "REG_ACC").map((s: any) => Number(s.sectionId));
            if (battleMuseumSectionIds.length != 5) throw new Error(`battleMuseumSectionIds.length != 5`);
            for (let sectionId of battleMuseumSectionIds) {
                let storyIds: string[] = StoryCollection.userQuestBattleList.map((entry: any) => entry.questBattle)
                    .filter((questBattle: any) => questBattle.sectionId === sectionId && questBattle.startStory != null)
                    .map((questBattle: any) => questBattle.startStory);
                if (storyIds.length != 4) throw new Error(`${sectionId} storyIds.length != 4`);
                await downloadStories(storyIds);
            }
        }

        const mss = async () => {
            // mss and costume
            const live2dIdSet = new Set<string>(mainAssetJson.filter((entry: assetListEntry) => entry.path.startsWith("image_native/live2d_v4/"))
                .map((entry: assetListEntry) => entry.path.split("/")[2]));
            const live2dIdList = Array.from(live2dIdSet);
            const costumeCountMap = new Map<string, number>();
            const invalidCharaIdSet = new Set<string>();
            for (let live2dId of live2dIdList) {
                if (!live2dId.match(/^\d{6}$/)) throw new Error(`!live2dId.match(/^\d{6}$/)`);
                let charaId = live2dId.substring(0, 4);
                let costumeId = live2dId.substring(4, 6);
                if (costumeId === "00") {
                    // mss
                    for (let i = 1; i <= 4; i++) {
                        let failedSet = new Set<string>();
                        let sectionId = Number(`3${charaId}${i}`);
                        let storyIdList = Array.from({ length: 9 }, (_, index) => index + 1).map((j) => `${sectionId}-${j}`);
                        await downloadStories(storyIdList, true, failedSet);
                        if (failedSet.size == storyIdList.length) {
                            if (1 == 1) invalidCharaIdSet.add(charaId);
                            break;
                        }
                    }
                } else {
                    // costume
                    let count = costumeCountMap.get(charaId);
                    if (count == null) count = 0;
                    count++;
                    costumeCountMap.set(charaId, count);
                }
            }
            for (let entry of costumeCountMap.entries()) {
                // costume
                let charaId = entry[0];
                let count = entry[1];
                if (invalidCharaIdSet.has(charaId)) continue;
                for (let i = 1; i <= count; i++) {
                    let failedSet = new Set<string>();
                    let sectionId = Number(`7${charaId}${i}`);
                    let storyIdList = Array.from({ length: 9 }, (_, index) => index + 1).map((j) => `${sectionId}-${j}`);
                    await downloadStories(storyIdList, true, failedSet);
                    if (failedSet.size == storyIdList.length) break;
                }
            }
        }

        // scene0 is buried in userQuestBattleList, not logically iteratable


        await mainStory();
        await eventStory();
        await mirrorsStory();
        await mss();


        const logicallyIteratedStoryIdSet = new Set(downloadedStoryIdSet);


        // outside the logically iteratable scope
        // from userQuestBattleList
        const remainingStoryIdList = Array.from(userQuestBattleStoryIdSet).filter((storyId) => !downloadedStoryIdSet.has(storyId));
        await downloadStories(remainingStoryIdList);
        // from TopPage.userQuestAdventureList
        const adventureIdSet = new Set<string>(TopPage.userQuestAdventureList.map((entry: any) => entry.adventureId));
        const downloadedStoryIdSetNoSecret = new Set<string>();
        for (let storyId of downloadedStoryIdSet) {
            if (!storyId.startsWith('9')) {
                let matched = storyId.match(/^\d{6,7}-\d+/);
                if (matched == null) throw new Error(`storyId = ${storyId} storyIdNoSecret matched == null`);
                let storyIdNoSecret = matched[0];
                downloadedStoryIdSetNoSecret.add(storyIdNoSecret);
            }
        }
        const adventureIdList = Array.from(adventureIdSet).filter((adventureId) => !downloadedStoryIdSetNoSecret.has(adventureId) && !downloadedStoryIdSet.has(adventureId));
        const undownloadableAdventureIdSet = new Set<string>();
        await downloadStories(adventureIdList, true, undownloadableAdventureIdSet);
        // from EnkanRec
        const noLongerdownloadableEnkanRecIdSet = new Set<string>();
        await downloadStories(Array.from(enkanRecStoryIdSet), true, noLongerdownloadableEnkanRecIdSet);


        fs.writeFileSync(`noLongerdownloadableEnkanRecIdSet.json`, JSON.stringify(Array.from(noLongerdownloadableEnkanRecIdSet), undefined, 2), 'utf-8');
        console.log(`noLongerdownloadableEnkanRecIdSet.size = ${noLongerdownloadableEnkanRecIdSet.size}`);
        fs.writeFileSync(`undownloadableAdventureIdSet.json`, JSON.stringify(Array.from(undownloadableAdventureIdSet), undefined, 2), 'utf-8');
        console.log(`undownloadableAdventureIdSet.size = ${undownloadableAdventureIdSet.size}`);
        fs.writeFileSync(`logicallyIteratedStoryIdSet.json`, JSON.stringify(Array.from(logicallyIteratedStoryIdSet), undefined, 2), 'utf-8');
        console.log(`logicallyIteratedStoryIdSet.size = ${logicallyIteratedStoryIdSet.size}`);
        fs.writeFileSync(`userQuestBattleStoryIdSet.json`, JSON.stringify(Array.from(userQuestBattleStoryIdSet), undefined, 2), 'utf-8');
        console.log(`userQuestBattleStoryIdSet.size = ${userQuestBattleStoryIdSet.size}`);
        fs.writeFileSync(`scene0StoryIdSet.json`, JSON.stringify(Array.from(scene0StoryIdSet), undefined, 2), 'utf-8');
        console.log(`scene0StoryIdSet.size = ${scene0StoryIdSet.size}`);
        fs.writeFileSync(`downloadedStoryIdSet.json`, JSON.stringify(Array.from(downloadedStoryIdSet), undefined, 2), 'utf-8');
        console.log(`downloadedStoryIdSet.size = ${downloadedStoryIdSet.size}`);
    }


    await fetchStories();
    await fetchWebRes();
    await fetchAssets();


    client?.destroy();
    client?.unref();


    fs.writeFileSync(`allFileMap.json`, JSON.stringify(Array.from(allFileMap), undefined, 2), 'utf-8');
    console.log(`allFileMap.size = ${allFileMap.size}`);
    fs.writeFileSync(`gotSet.json`, JSON.stringify(Array.from(gotSet), undefined, 2), 'utf-8');
    console.log(`gotSet.size = ${gotSet.size}`);

    filterStats();

    return gotSet.size;
}

const filterStats = () => {
    const fs = require('node:fs');
    const path = require('node:path');

    const unresolvedImgPaths = new Map<string, string>(JSON.parse(fs.readFileSync('unresolvedImgPaths.json')));
    const errImgPaths = new Map<string, string>(JSON.parse(fs.readFileSync('errImgPaths.json')));

    let filtered = Array.from(unresolvedImgPaths).filter((e) => {
        let url = e[0], src = e[1];
        if (!url.startsWith('/magica/')) url = `/magica/${url}`;
        if (url.startsWith('/magica/resource/image_native')) return false;
        if (url.includes(' resDir ')) return false;
        return true;
    });

    fs.writeFileSync('unresolvedImgPaths_filtered.json', JSON.stringify(filtered, undefined, 2));
    console.log('unresolvedImgPaths_filtered.json', filtered.length);


    const errImgPaths_image_web = new Map();
    function checkFile(p: string) { if (!p.startsWith('/magica/')) p = `/magica/${p}`; return fs.existsSync(path.join('static_staging_jp', p)) }
    filtered = Array.from(errImgPaths).filter((e) => {
        let url = e[0], src = e[1];
        let origUrl = url;
        if (!url.startsWith('/magica/')) url = `/magica/${url}`;

        if (checkFile(url)) return false;
        if (checkFile(`/magica/resource/image_native/tips/${origUrl}`)) return false;
        if (checkFile(`/magica/resource/image_native/bg/story/${origUrl}`)) return false;
        if (checkFile(`/magica/resource/image_web/page/mission/doppelMission/common${origUrl}`)) return false;
        if (origUrl.includes(' ')) {
            let filtered = origUrl.split(' ').filter(u => !checkFile(`/magica/resource/image_web/event/singleraid/common/animation/${u}`));
            if (filtered.length == 0) return false;
        }

        if (src === "replacement_cn.js") return false;
        let checkedOkaySrc = new Set([
            "js/view/mission/MissionTopView.js",
            "js/gacha/GachaResult.js",
            "js/collection/DoppelCollection.js",
            "js/view/user/GlobalMenuView.js",
            "js/gacha/GachaTop.js",
            "js/test/RealGachaTop.js",
            "js/event/accomplish/EventAccomplishTop.js",
            "js/quest/EventQuest.js",
            "js/quest/puellaHistoria/MirrorPartsView.js",
            "js/mission/DoppelMissionTop.js",
            "template/event/raid/EventRaidTop.html", // only two, covered by replacement_cn
            "template/event/raid/EventRaidCurePopupParts.html",
            "template/event/raid/EventRaidRewardParts.html",
            "template/patrol/PatrolTop.html",
            "template/event/singleraid/EventSingleRaidTop.html",
            "template/event/singleraid/EventSingleRaidSelect.html",
            "template/base/ItemImgView.html",
            "template/event/dailytower/EventDailyTowerTop.html", // incomplete
            "template/formation/DeckFormation.html",
            "template/event/accomplish/EventAccomplishTop.html",
            "template/event/training/EventTrainingCharaSelect.html",
            "template/arena/ArenaConfirm.html",
            "template/event/arenaMission/EventArenaMissionConfirm.html", // only one, covered by replacement_cn
            "template/event/arenaMission/EventArenaMissionTop.html",
            "template/event/arenaMission/EventArenaMissionResult.html",
            "template/event/branch/EventBranchTop.html", // incomplete, lacks item id
            "template/event/tower/EventTowerTop.html",
            "template/event/dungeon/EventDungeonTop.html",
            "template/event/dungeon/EventDungeonClearAnimation.html",
            "template/event/storyraid/EventStoryRaidSelect.html", // not exist in StoryCollection
            "template/event/storyraid/EventStoryRaidBoss.html",
            "template/event/storyraid/EventStoryRaidTop.html",
            "template/regularEvent/groupBattle/RegularEventGroupBattleMission.html", // ignore
            "template/follow/FollowPopup.html", // titles
            "template/user/SetTitlePopup.html",
            "template/event/EventArenaRankMatch/Result.html",
            "template/event/EventWitch/parts/IconCharaGauge.html",
            "template/quest/puellaHistoria/lastBattle/QuestResultSubBoss.html",
            "template/quest/puellaHistoria/lastBattle/Stamp.html",
            "template/arena/ArenaResult.html",
            "template/arena/ArenaTop.html",
            "template/arena/ArenaReward.html",
            "template/present/GachaHistory.html",
            "template/test/PresentListTest.html",
            "template/test/Backdoor.html",
            "template/quest/SectionClearAnimation.html",
            "template/quest/EventQuest.html",
            "template/quest/PreQuestPopup.html",
            "template/quest/SupportSelect.html",
            "template/collection/MagiRepoDetail.html",
            "template/item/ItemListTop.html", // stickers
            "template/tutorial/TutorialNavi.html", // incomplete, dont know how to handle campaign
        ]);
        if (checkedOkaySrc.has(src)) return false;

        if (url.startsWith('/magica/resource/image_web/')) {
            errImgPaths_image_web.set(origUrl, src);
            return false;
        }
        return true;
    });

    fs.writeFileSync('errImgPaths_filtered.json', JSON.stringify(filtered, undefined, 2));
    console.log('errImgPaths_filtered.json', filtered.length);


    fs.writeFileSync('errImgPaths_image_web.json', JSON.stringify(Array.from(errImgPaths_image_web.entries()), undefined, 2));
    console.log('errImgPaths_image_web.json', errImgPaths_image_web.size);
}