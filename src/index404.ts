import * as crypto from "crypto";

export const index404 = Buffer.from(`PGh0bWwgbGFuZz0iamEiIHN0eWxlPSJoZWlnaHQ6IDU3NnB4OyI+Cgo8aGVhZD4KICAgIDxtZXRh`
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

export const index404md5 = crypto.createHash('md5').update(index404).digest().toString('hex');