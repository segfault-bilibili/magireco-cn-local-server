"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portFinder = void 0;
const net = require("net");
class portFinder {
    static test(port, host) {
        return new Promise((res, rej) => {
            if (port <= 0 || port >= 65536) {
                rej(new Error("port out of range"));
                return;
            }
            if (host == null)
                host = "127.0.0.1";
            let server = net.createServer();
            let options = {
                port: port,
                host: host,
                exclusive: true,
            };
            server.listen(options);
            server.on('listening', () => {
                server.close();
                res(true);
            });
            server.once('error', (err) => {
                server.close();
                console.error(`port ${port} unavailable: ${err.message}`);
                res(false);
            });
        });
    }
    static async findAfter(port, host) {
        if (port <= 0 || port >= 65536)
            throw new Error("port out of range");
        for (; port < 65536; port++) {
            if (await this.test(port, host))
                return port;
        }
        throw new Error("cannot find available port");
    }
}
exports.portFinder = portFinder;
