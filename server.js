require('dotenv').config();
const app = require('./src/app');
const { getPool } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
    console.log(`===============================================`);
    console.log(`🎬 Server Web Xem Phim đang chạy tại:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`===============================================`);

    // Thử kết nối cơ sở dữ liệu khi khởi động
    try {
        await getPool();
    } catch (err) {
        console.log(`ℹ️ [Database]: Chưa kết nối được SQL Server (${err.message}). API đang dùng dữ liệu mô phỏng.`);
    }
});

// Xử lý đóng server an toàn
process.on('SIGINT', () => {
    console.log('\n🛑 Đang dừng server...');
    server.close(() => {
        console.log('✅ Server đã đóng an toàn.');
        process.exit(0);
    });
});
