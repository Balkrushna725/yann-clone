const express = require('express');
const { authorizeRoles } = require('../middleware/auth.middleware');
const cabController = require('../controllers/cab.controller');

const router = express.Router();

router.post('/book', authorizeRoles('user'), cabController.bookCab);
router.post('/accept', authorizeRoles('driver'), cabController.acceptCab);
router.post('/start', authorizeRoles('driver'), cabController.startCab);
router.post('/end', authorizeRoles('driver'), cabController.endCab);

router.post('/location', authorizeRoles('driver'), cabController.pushLiveLocation);
router.get('/location/:cab_booking_id', cabController.getLiveLocationTrail);

router.post('/emergency', authorizeRoles('user'), cabController.reportEmergency);

module.exports = router;
