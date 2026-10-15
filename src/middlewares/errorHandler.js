// Middleware xử lý lỗi tập trung
function errorHandler(err, req, res, next) {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Đã xảy ra lỗi trên máy chủ nội bộ',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
}

module.exports = errorHandler;
