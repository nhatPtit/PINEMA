const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

router.get('/coupons', bookingController.getAvailableCoupons);
router.post('/validate-coupon', bookingController.validateCoupon);
router.post('/book', bookingController.createBooking);
router.get('/history/:customerId', bookingController.getBookingHistory);

module.exports = router;
