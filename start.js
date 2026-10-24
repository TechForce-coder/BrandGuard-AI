
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const rootDir = __dirname;
const clientDir = path.join(rootDir, "client");
const serverDir = path.join(rootDir, "server");
const serverFile = path.join(serverDir, "server.js");

console.log("\nBuilding BrandGuard AI frontend...\n");

const build = spawnSync(
    "npm",
    ["run", "build"],
    {
        cwd: clientDir,
        stdio: "inherit",
        shell: process.platform === "win32"
    }
);

if (build.error) {
    console.error("Could not start the frontend build:", build.error.message);
    process.exit(1);
}

if (build.status !== 0) {
    console.error("\nFrontend build failed. Backend was not started.");
    process.exit(1);
}

console.log("\nFrontend build completed.");
console.log("Starting BrandGuard AI backend...\n");

const server = spawn(
    process.execPath,
    [serverFile],
    {
        cwd: serverDir,
        stdio: "inherit",
        env: {
            ...process.env,
            NODE_ENV: "production"
        }
    }
);

let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\nReceived ${signal}. Stopping backend...`);

    if (server.exitCode === null && !server.killed) {
        server.kill(signal);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("error", (error) => {
    console.error("Could not start backend:", error.message);
    process.exitCode = 1;
});

server.on("exit", (code, signal) => {
    if (signal) {
        console.log(`Backend stopped by ${signal}.`);
    } else {
        console.log(`Backend exited with code ${code}.`);
    }

    if (!shuttingDown && code !== 0) {
        process.exitCode = code || 1;
    }
});
