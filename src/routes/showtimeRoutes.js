const express = require('express');
const router = express.Router();
const showtimeController = require('../controllers/showtimeController');

router.get('/movie/:movieId', showtimeController.getShowtimesByMovie);
router.get('/room/:roomId', showtimeController.getShowtimesByRoom);
router.get('/:id', showtimeController.getShowtimeDetail);

module.exports = router;
