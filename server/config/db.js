
const mongoose = require("mongoose");

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured");
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected successfully!");
    } catch {
        throw new Error("MongoDB connection failed. Check MONGO_URI and database availability.");
    }
};

module.exports = connectDB;