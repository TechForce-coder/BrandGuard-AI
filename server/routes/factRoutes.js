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
router.get("/", listResource("facts"));
router.post("/", createResource("facts"));
router.put("/:id", updateResource("facts"));
router.delete("/:id", deleteResource("facts"));

module.exports = router;
