
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");

async function makeAdmin() {
    try {
        const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

        if (!process.env.MONGO_URI || !process.env.ADMIN_EMAIL) {
    throw new Error("MONGO_URI and ADMIN_EMAIL must be set in .env");
}

await mongoose.connect(process.env.MONGO_URI);

        const user = await User.findOne({ email });

        if (!user) {
            console.log("User not found. Register this account first.");
            return;
        }

        user.role = "admin";
        user.tokenVersion += 1;

        await user.save();

        console.log(`Admin role assigned to ${user.email}`);
    } catch (error) {
        console.error("Admin setup failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

makeAdmin();
