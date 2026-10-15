const express = require('express');
const router = express.Router();
const cinemaController = require('../controllers/cinemaController');

router.get('/', cinemaController.getAllCinemas);
router.get('/:cinemaId/rooms', cinemaController.getRoomsByCinema);
router.get('/rooms/:roomId/seats', cinemaController.getSeatsByRoom);

module.exports = router;
