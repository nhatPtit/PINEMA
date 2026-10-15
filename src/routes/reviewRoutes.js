const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.get('/movie/:movieId', reviewController.getReviewsByMovie);
router.get('/cinema/:cinemaId', reviewController.getReviewsByCinema);
router.get('/check-eligibility', reviewController.checkEligibility);
router.post('/', reviewController.addReview);

module.exports = router;
