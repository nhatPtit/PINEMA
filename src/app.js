const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const movieRoutes = require('./routes/movieRoutes');
const cinemaRoutes = require('./routes/cinemaRoutes');
const showtimeRoutes = require('./routes/showtimeRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const staffRoutes = require('./routes/staffRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares cơ bản
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cung cấp các file tĩnh Frontend (HTML, CSS, JS) từ thư mục public
app.use(express.static(path.join(__dirname, '../public')));

// Kiểm tra trạng thái hệ thống
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        timestamp: new Date(),
        version: '1.0.0'
    });
});

// Các API endpoints phân theo nhánh tính năng
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/cinemas', cinemaRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/staff', staffRoutes);

// Fallback: Nếu không khớp route API nào và không phải file tĩnh, trả về index.html cho SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.path} không tồn tại!` });
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Middleware xử lý lỗi
app.use(errorHandler);

module.exports = app;
