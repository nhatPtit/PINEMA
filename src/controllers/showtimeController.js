// Quản lý Suất Chiếu - Kết nối SQL Server RapPhim
const { getPool, sql } = require('../config/db');

const showtimeController = {
    // Lấy suất chiếu theo Phim
    getShowtimesByMovie: async (req, res) => {
        try {
            const { movieId } = req.params;
            const pool = await getPool();

            const query = `
                SELECT 
                    sc.MaSuat,
                    sc.MaPhim,
                    sc.MaPhong,
                    pc.TenPhong,
                    pc.CongNgheHoTro,
                    pc.PhuPhiCongNghe,
                    r.MaRap,
                    r.TenRap,
                    CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS ThoiGianBatDau,
                    CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS ThoiGianKetThuc,
                    sc.GiaVeCoBan
                FROM dbo.SuatChieu sc
                JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                WHERE sc.MaPhim = @movieId
                  AND sc.GioBatDau >= GETDATE()
                ORDER BY sc.GioBatDau ASC
            `;

            const result = await pool.request()
                .input('movieId', sql.Int, parseInt(movieId))
                .query(query);

            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getShowtimesByMovie:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy danh sách suất chiếu theo Phòng Chiếu
    getShowtimesByRoom: async (req, res) => {
        try {
            const { roomId } = req.params;
            const pool = await getPool();

            const query = `
                SELECT 
                    sc.MaSuat,
                    sc.MaPhong,
                    sc.MaPhim,
                    p.TenPhim,
                    p.Poster,
                    p.ThoiLuong,
                    p.DoTuoi,
                    pc.TenPhong,
                    pc.CongNgheHoTro,
                    pc.PhuPhiCongNghe,
                    r.MaRap,
                    CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS ThoiGianBatDau,
                    CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS ThoiGianKetThuc,
                    sc.GiaVeCoBan
                FROM dbo.SuatChieu sc
                JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                WHERE sc.MaPhong = @roomId
                  AND sc.GioBatDau >= GETDATE()
                ORDER BY sc.GioBatDau ASC
            `;

            const result = await pool.request()
                .input('roomId', sql.Int, parseInt(roomId))
                .query(query);

            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getShowtimesByRoom:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Chi tiết suất chiếu kèm trạng thái ghế đã đặt
    getShowtimeDetail: async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await getPool();

            const queryShowtime = `
                SELECT 
                    sc.MaSuat,
                    sc.MaPhim,
                    p.TenPhim,
                    r.TenRap,
                    pc.MaPhong,
                    pc.TenPhong,
                    pc.CongNgheHoTro,
                    pc.PhuPhiCongNghe,
                    CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS ThoiGianBatDau,
                    CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS ThoiGianKetThuc,
                    sc.GiaVeCoBan
                FROM dbo.SuatChieu sc
                JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                WHERE sc.MaSuat = @showtimeId
            `;

            const showtimeResult = await pool.request()
                .input('showtimeId', sql.Int, parseInt(id))
                .query(queryShowtime);

            if (showtimeResult.recordset.length === 0) {
                return res.status(404).json({ success: false, message: "Không tìm thấy suất chiếu" });
            }

            const showtime = showtimeResult.recordset[0];

            // Lấy danh sách mã ghế đã được đặt trong suất này
            const queryBookedSeats = `
                SELECT MaGhe 
                FROM dbo.Ve 
                WHERE MaSuat = @showtimeId AND TrangThai <> N'Đã hủy'
            `;

            const bookedResult = await pool.request()
                .input('showtimeId', sql.Int, parseInt(id))
                .query(queryBookedSeats);

            showtime.GheDaDat = bookedResult.recordset.map(row => row.MaGhe);

            res.status(200).json({ success: true, data: showtime });
        } catch (error) {
            console.error('Lỗi getShowtimeDetail:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = showtimeController;
