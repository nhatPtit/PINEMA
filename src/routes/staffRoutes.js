const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// Tổng quan
router.get('/overview', staffController.getDashboardOverview);

// Phim
router.post('/movies', staffController.createMovie);
router.put('/movies/:id', staffController.updateMovie);
router.delete('/movies/:id', staffController.deleteMovie);

// Suất Chiếu
router.get('/showtimes', staffController.getStaffShowtimes);
router.post('/showtimes', staffController.createShowtime);
router.delete('/showtimes/:id', staffController.deleteShowtime);

// Soát Vé & Check-in Theo Hóa Đơn
router.get('/checkin/search', staffController.searchTicketForCheckIn);
router.post('/checkin/confirm', staffController.confirmCheckIn);
router.post('/checkin/confirm-invoice', staffController.confirmInvoiceCheckIn);

// Phòng Chiếu & Ghế
router.get('/rooms/:roomId/seats', staffController.getRoomSeatsForStaff);
router.put('/seats/status', staffController.updateSeatCondition);

// Mã Giảm Giá Coupon
router.get('/coupons', staffController.getCouponsList);
router.post('/coupons', staffController.createCoupon);
router.delete('/coupons/:code', staffController.deleteCoupon);

// Báo Cáo Thống Kê (Q5, Q6, Q7, Q9, Q10)
router.get('/reports', staffController.getBTLReports);

// Nghiệp Vụ Bán Vé Tại Quầy (POS Counter Booking)
router.get('/pos/movies', staffController.getPosMovies);
router.get('/pos/showtimes', staffController.getPosShowtimes);
router.get('/pos/seat-map', staffController.getPosSeatMap);
router.post('/pos/book', staffController.createPosBooking);

module.exports = router;
