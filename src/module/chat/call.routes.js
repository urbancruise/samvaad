const router = require("express").Router();

const auth = require("../../middlewares/auth.middleware");
const { getCallHistory } = require("./call.controller");

router.use(auth);
router.get("/history", getCallHistory);

module.exports = router;