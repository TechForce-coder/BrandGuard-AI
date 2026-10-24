require("dotenv").config();

process.env.PORT = process.env.DEV_API_PORT || "5001";
process.env.NODE_ENV = "development";

console.log(`Starting the development API on port ${process.env.PORT}`);
require("./server");
