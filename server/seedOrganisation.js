require("dotenv").config();

const mongoose = require("mongoose");
const Organisation = require("./models/Organisation");

async function seedOrganisation() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        let organisation = await Organisation.findOne({
            name: "Tech Force"
        });

        if (!organisation) {
            organisation = await Organisation.create({
                name: "Tech Force"
            });
        }

        console.log("Organisation ID:", organisation._id.toString());
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

seedOrganisation();