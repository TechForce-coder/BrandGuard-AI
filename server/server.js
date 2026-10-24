require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

const startServer = async () => {
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error("PORT must be a valid TCP port number");
    }
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    await connectDB();

    const server = app.listen(PORT, () => {
        console.log(`BrandGuard AI server listening on port ${PORT}`);
    });

    server.on("error", (error) => {
        console.error(`Unable to listen on port ${PORT}: ${error.message}`);
        require("mongoose").disconnect()
            .catch((disconnectError) => {
                console.error("Database shutdown failed:", disconnectError.message);
            })
            .finally(() => {
                process.exitCode = 1;
            });
    });

    const shutdown = (signal) => {
        server.close(async () => {
            console.log(`BrandGuard AI server stopped (${signal})`);
            const mongoose = require("mongoose");
            await mongoose.disconnect().catch((error) => {
                console.error("Database shutdown failed:", error.message);
                process.exitCode = 1;
            });
        });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
};

startServer().catch((error) => {
    console.error("BrandGuard AI startup failed:", error.message);
    process.exitCode = 1;
});
