const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/authMiddleware");
const {
    listResource,
    createResource,
    updateResource,
    deleteResource
} = require("../controllers/catalogController");

const router = express.Router();
const managers = ["manager", "admin"];

router.use(authenticate, authorizeRoles(...managers));
router.get("/", listResource("rules"));
router.post("/", createResource("rules"));
router.put("/:id", updateResource("rules"));
router.delete("/:id", deleteResource("rules"));

module.exports = router;
