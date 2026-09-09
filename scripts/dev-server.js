import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { spawn } from "node:child_process";
import process from "node:process";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");

const HOST = "0.0.0.0";
const PORT = 3000;

const WATCH_DIRECTORIES = [
    path.join(ROOT, "content"),
    path.join(ROOT, "src"),
    path.join(ROOT, "public")
];

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",

    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",

    ".ico": "image/x-icon",

    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf"
};

let server = null;
let rebuildTimer = null;
let isBuilding = false;
let rebuildQueued = false;
let shuttingDown = false;

function log(message = "") {
    console.log(message);
}

function getLocalNetworkIP() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            // Prefer IPv4 and non-internal addresses
            const isIPv4 = iface.family === "IPv4" || iface.family === 4;

            if (isIPv4 && !iface.internal) {
                return iface.address;
            }
        }
    }

    return null;
}

function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function runBuild() {
    return new Promise((resolve, reject) => {
        if (isBuilding) {
            rebuildQueued = true;
            resolve();
            return;
        }

        isBuilding = true;

        log("");
        log("────────────────────────────────────────");
        log("Building Difurrent...");
        log("────────────────────────────────────────");
        log("");

        const buildProcess = spawn(
            process.execPath,
            [path.join(ROOT, "scripts", "build-content.js")],
            {
                cwd: ROOT,
                stdio: "inherit"
            }
        );

        buildProcess.on("error", (error) => {
            isBuilding = false;
            reject(error);
        });

        buildProcess.on("exit", async (code, signal) => {
            isBuilding = false;

            if (signal) {
                reject(
                    new Error(
                        `Build process terminated by signal: ${signal}`
                    )
                );
                return;
            }

            if (code !== 0) {
                console.error("");
                console.error(
                    `Build failed with exit code ${code}.`
                );
                console.error(
                    "The development server will remain running."
                );

                resolve();
                return;
            }

            resolve();

            if (rebuildQueued) {
                rebuildQueued = false;
                await runBuild();
            }
        });
    });
}

function scheduleBuild(reason) {
    if (shuttingDown) {
        return;
    }

    log("");
    log(`Change detected: ${reason}`);

    clearTimeout(rebuildTimer);

    rebuildTimer = setTimeout(async () => {
        try {
            await runBuild();
        } catch (error) {
            console.error("");
            console.error("Build process error:");
            console.error(error);
        }
    }, 250);
}

function getContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return MIME_TYPES[extension] || "application/octet-stream";
}

function safeResolve(requestPath) {
    let decodedPath;

    try {
        decodedPath = decodeURIComponent(requestPath);
    } catch {
        return null;
    }

    const normalizedPath = path.normalize(decodedPath);
    const relativePath = normalizedPath.replace(/^([/\\])+/, "");
    const absolutePath = path.resolve(DIST_DIR, relativePath);
    const relativeToDist = path.relative(DIST_DIR, absolutePath);

    if (
        relativeToDist.startsWith("..") ||
        path.isAbsolute(relativeToDist)
    ) {
        return null;
    }

    return absolutePath;
}

function resolveRequestedFile(requestPath) {
    const requestedPath = requestPath.split("?")[0];
    let filePath = safeResolve(requestedPath);

    if (!filePath) {
        return null;
    }

    if (fileExists(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            return filePath;
        }
    }

    // Directory request → index.html
    if (fileExists(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            const indexPath = path.join(filePath, "index.html");
            if (fileExists(indexPath)) {
                return indexPath;
            }
        }
    }

    // No extension → try index.html
    if (!path.extname(filePath)) {
        const indexPath = path.join(filePath, "index.html");
        if (fileExists(indexPath)) {
            return indexPath;
        }
    }

    return null;
}

function sendResponse(res, statusCode, contentType, body) {
    res.writeHead(statusCode, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache"
    });
    res.end(body);
}

function serveFile(req, res) {
    const requestUrl = req.url || "/";
    const filePath = resolveRequestedFile(requestUrl);

    if (!filePath) {
        sendResponse(
            res,
            404,
            "text/html; charset=utf-8",
            `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>404 — Difurrent</title>
    <style>
        body {
            margin: 0;
            padding: 4rem;
            font-family: system-ui, sans-serif;
            background: #f4f4f1;
            color: #111;
        }
        h1 { margin-bottom: 1rem; }
        a { color: inherit; }
    </style>
</head>
<body>
    <h1>404</h1>
    <p>The requested resource could not be found.</p>
    <p><a href="/">Return to Difurrent</a></p>
</body>
</html>
            `
        );
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            console.error(`Failed to read ${filePath}:`, error);
            sendResponse(
                res,
                500,
                "text/plain; charset=utf-8",
                "Internal server error."
            );
            return;
        }

        sendResponse(res, 200, getContentType(filePath), data);
    });
}

function createServer() {
    server = http.createServer((req, res) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, {
                "Content-Type": "text/plain; charset=utf-8",
                "Allow": "GET, HEAD"
            });
            res.end("Method Not Allowed");
            return;
        }

        if (!fileExists(DIST_DIR)) {
            sendResponse(
                res,
                503,
                "text/plain; charset=utf-8",
                "Difurrent is building. Please refresh shortly."
            );
            return;
        }

        if (req.method === "HEAD") {
            const requestUrl = req.url || "/";
            const filePath = resolveRequestedFile(requestUrl);

            if (!filePath) {
                res.writeHead(404);
                res.end();
                return;
            }

            res.writeHead(200, {
                "Content-Type": getContentType(filePath),
                "Cache-Control": "no-cache"
            });
            res.end();
            return;
        }

        serveFile(req, res);
    });

    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.error("");
            console.error(`Port ${PORT} is already in use.`);
            console.error(
                `Try closing the application using http://localhost:${PORT}`
            );
            console.error("");
            shutdown(1);
            return;
        }

        console.error("Development server error:");
        console.error(error);
        shutdown(1);
    });

    server.listen(PORT, HOST, () => {
        const networkIP = getLocalNetworkIP();

        log("");
        log("────────────────────────────────────────");
        log("Difurrent development server");
        log("────────────────────────────────────────");
        log("");
        log(`Local:    http://localhost:${PORT}`);

        if (networkIP) {
            log(`Network:  http://${networkIP}:${PORT}`);
        } else {
            log(`Network:  (could not detect local IP)`);
        }

        log("");
        log("Watching:");
        log(`  ${path.relative(ROOT, WATCH_DIRECTORIES[0])}`);
        log(`  ${path.relative(ROOT, WATCH_DIRECTORIES[1])}`);
        log(`  ${path.relative(ROOT, WATCH_DIRECTORIES[2])}`);
        log("");
        log("Press Ctrl+C to stop.");
        log("");
    });
}

function watchDirectory(directory) {
    if (!fileExists(directory)) {
        console.warn(`Watch directory does not exist: ${directory}`);
        return;
    }

    try {
        fs.watch(
            directory,
            { recursive: true },
            (eventType, filename) => {
                if (!filename) {
                    scheduleBuild(
                        `${eventType} in ${path.relative(ROOT, directory)}`
                    );
                    return;
                }

                const relativeFile = path.join(
                    path.relative(ROOT, directory),
                    filename.toString()
                );

                scheduleBuild(`${eventType}: ${relativeFile}`);
            }
        );
    } catch (error) {
        console.error("");
        console.error(`Unable to watch ${directory}`);
        console.error(error);
    }
}

function startWatching() {
    for (const directory of WATCH_DIRECTORIES) {
        watchDirectory(directory);
    }
}

function shutdown(exitCode = 0) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    clearTimeout(rebuildTimer);

    log("");
    log("Stopping Difurrent development server...");

    if (server) {
        server.close(() => {
            process.exit(exitCode);
        });
        return;
    }

    process.exit(exitCode);
}

process.on("SIGINT", () => {
    shutdown(0);
});

process.on("SIGTERM", () => {
    shutdown(0);
});

async function main() {
    try {
        await runBuild();
        createServer();
        startWatching();
    } catch (error) {
        console.error("");
        console.error("Unable to start the development environment.");
        console.error("");
        console.error(error);
        shutdown(1);
    }
}

main();