
const express = require("express");
const router = express.Router();

const {
    createOrganisation
} = require("../controllers/organisationController");

router.post("/", createOrganisation);

module.exports = router;
