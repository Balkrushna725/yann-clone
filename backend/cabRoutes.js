const express = require('express');
const router = express.Router();
const cabController = require('../controllers/cabController');

// Book a new cab ride
router.post('/book', cabController.bookCab);

// Driver accepts the ride
router.post('/accept', cabController.acceptRide);

// Start the ride
router.post('/start', cabController.startRide);

// End the ride
router.post('/end', cabController.endRide);

// Report emergency during ride
router.post('/emergency', cabController.reportEmergency);

module.exports = router;
