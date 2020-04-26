const express = require("express");
const userController = require("../controllers/userController");
const challengeController = require("../controllers/challengeController");

const router = express.Router();

// const { userController, challengesController } = require("./../controllers");

// router.post("/auth", userController.master);
// router.post("/phoneVerification", userController.addPhoneNumber);
// router.post("/dashboard", userController.getDashboard);
// router.post("/challenges/add", challengesController.create);

// router.post("/test", userController.test);

router.post("/loginWithGoogle", userController.loginWithGoogle);
router.post("/loginWithFacebook", userController.loginWithFacebook);
router.post("/phoneVerification", userController.addPhoneNumber);
router.post("/createChallenge", challengeController.createChallenge);
router.post("/participateChallenge", userController.participateInChallenge);
router.post("/getTags", userController.getTaggingTree);
router.post("/getDashboard", userController.getDashboard);
router.post("/auth", userController.auth);

module.exports = router;
