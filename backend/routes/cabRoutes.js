const express = require('express');
const router = express.Router();
const cabController = require('../controllers/cabController');

router.post('/book', cabController.bookCab);
router.post('/accept', cabController.acceptRide);
router.post('/start', cabController.startRide);
router.post('/end', cabController.endRide);
router.post('/emergency', cabController.reportEmergency);

module.exports = router;
