// Quản lý Rạp, Phòng Chiếu & Ghế - Kết nối SQL Server RapPhim
const { getPool, sql } = require('../config/db');

const cinemaController = {
    // Lấy danh sách tất cả các Rạp
    getAllCinemas: async (req, res) => {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT 
                    r.MaRap, 
                    r.TenRap, 
                    r.DiaChi, 
                    r.ChiTiet,
                    r.PhuongXa,
                    r.Tinh,
                    r.SoDienThoai AS SDT,
                    COUNT(p.MaPhong) AS SoPhong,
                    COALESCE(SUM(p.SoLuongGhe), 0) AS TongSoGhe
                FROM dbo.Rap r
                LEFT JOIN dbo.PhongChieu p ON r.MaRap = p.MaRap
                GROUP BY r.MaRap, r.TenRap, r.DiaChi, r.ChiTiet, r.PhuongXa, r.Tinh, r.SoDienThoai
                ORDER BY r.MaRap
            `);
            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getAllCinemas:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy danh sách phòng chiếu của một rạp
    getRoomsByCinema: async (req, res) => {
        try {
            const { cinemaId } = req.params;
            const pool = await getPool();
            const result = await pool.request()
                .input('cinemaId', sql.Int, parseInt(cinemaId))
                .query('SELECT * FROM dbo.PhongChieu WHERE MaRap = @cinemaId ORDER BY MaPhong');
            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getRoomsByCinema:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy danh sách ghế của một phòng chiếu
    getSeatsByRoom: async (req, res) => {
        try {
            const { roomId } = req.params;
            const pool = await getPool();
            const result = await pool.request()
                .input('roomId', sql.Int, parseInt(roomId))
                .query('SELECT * FROM dbo.Ghe WHERE MaPhong = @roomId ORDER BY Hang, Cot');
            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getSeatsByRoom:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = cinemaController;
