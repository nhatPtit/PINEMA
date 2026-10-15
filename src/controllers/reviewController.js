const { getPool, sql } = require('../config/db');

// Quản lý Đánh Giá (Review) - Kết nối CSDL RapPhim (bảng DanhGia và view vw_DanhGiaChiTiet)
const reviewController = {
    // 1. Lấy danh sách đánh giá theo phim
    getReviewsByMovie: async (req, res) => {
        try {
            const { movieId } = req.params;
            const pool = await getPool();

            const query = `
                SELECT 
                    dg.MaKhachHang,
                    kh.HoTen AS TenKhachHang,
                    dg.MaHoaDon,
                    dg.Diem,
                    dg.NoiDung,
                    dg.MaPhim,
                    p.TenPhim
                FROM dbo.DanhGia dg
                JOIN dbo.KhachHang kh ON dg.MaKhachHang = kh.MaKhachHang
                LEFT JOIN dbo.Phim p ON dg.MaPhim = p.MaPhim
                WHERE dg.MaPhim = @movieId AND dg.DoiTuong = N'Phim'
                ORDER BY dg.MaHoaDon DESC
            `;

            const result = await pool.request()
                .input('movieId', sql.Int, parseInt(movieId))
                .query(query);

            res.status(200).json({ success: true, total: result.recordset.length, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getReviewsByMovie:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 2. Lấy danh sách đánh giá theo cụm rạp
    getReviewsByCinema: async (req, res) => {
        try {
            const { cinemaId } = req.params;
            const pool = await getPool();

            const query = `
                SELECT 
                    dg.MaKhachHang,
                    kh.HoTen AS TenKhachHang,
                    dg.MaHoaDon,
                    dg.Diem,
                    dg.NoiDung,
                    dg.MaRap,
                    r.TenRap
                FROM dbo.DanhGia dg
                JOIN dbo.KhachHang kh ON dg.MaKhachHang = kh.MaKhachHang
                LEFT JOIN dbo.Rap r ON dg.MaRap = r.MaRap
                WHERE dg.MaRap = @cinemaId AND dg.DoiTuong = N'Rạp'
                ORDER BY dg.MaHoaDon DESC
            `;

            const result = await pool.request()
                .input('cinemaId', sql.Int, parseInt(cinemaId))
                .query(query);

            res.status(200).json({ success: true, total: result.recordset.length, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getReviewsByCinema:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 3. Kiểm tra khách hàng có đủ điều kiện đánh giá phim/rạp này không (phải có hóa đơn đã thanh toán)
    checkEligibility: async (req, res) => {
        try {
            const { customerId, movieId, cinemaId } = req.query;
            if (!customerId) {
                return res.status(200).json({ success: true, canReview: false, message: 'Chưa đăng nhập' });
            }

            const pool = await getPool();

            if (movieId) {
                const query = `
                    SELECT TOP 1 hd.MaHoaDon
                    FROM dbo.HoaDon hd
                    JOIN dbo.Ve v ON hd.MaHoaDon = v.MaHoaDon
                    JOIN dbo.SuatChieu sc ON v.MaSuat = sc.MaSuat
                    WHERE hd.MaKhachHang = @customerId 
                      AND sc.MaPhim = @movieId 
                      AND hd.TrangThai = N'Đã thanh toán'
                      AND v.TrangThai = N'Đã thanh toán'
                    ORDER BY hd.ThoiDiemLap DESC
                `;
                const result = await pool.request()
                    .input('customerId', sql.Int, parseInt(customerId))
                    .input('movieId', sql.Int, parseInt(movieId))
                    .query(query);

                if (result.recordset.length > 0) {
                    const maHoaDon = result.recordset[0].MaHoaDon;
                    // Kiểm tra xem đã đánh giá chưa
                    const checkReviewed = await pool.request()
                        .input('customerId', sql.Int, parseInt(customerId))
                        .input('maHoaDon', sql.Int, maHoaDon)
                        .input('doiTuong', sql.NVarChar(10), 'Phim')
                        .query('SELECT Diem, NoiDung FROM dbo.DanhGia WHERE MaKhachHang = @customerId AND MaHoaDon = @maHoaDon AND DoiTuong = @doiTuong');

                    const isReviewed = checkReviewed.recordset.length > 0;
                    return res.status(200).json({
                        success: true,
                        canReview: true,
                        maHoaDon: maHoaDon,
                        alreadyReviewed: isReviewed,
                        existingReview: isReviewed ? checkReviewed.recordset[0] : null
                    });
                }
            }

            return res.status(200).json({
                success: true,
                canReview: false,
                message: 'Bạn cần mua vé xem phim này để có thể gửi đánh giá!'
            });
        } catch (error) {
            console.error('Lỗi checkEligibility:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 4. Gửi đánh giá mới (hoặc cập nhật đánh giá cũ) tuân thủ các Check Constraints của CSDL
    addReview: async (req, res) => {
        try {
            const { maKhachHang, maHoaDon, doiTuong, diem, noiDung } = req.body;

            if (!maKhachHang || !maHoaDon || !doiTuong || !diem || !noiDung) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng điền đầy đủ điểm đánh giá và nội dung nhận xét!"
                });
            }

            const diemNum = parseInt(diem, 10);
            if (isNaN(diemNum) || diemNum < 1 || diemNum > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Điểm đánh giá phải là số nguyên từ 1 đến 5 sao!"
                });
            }

            const cleanDoiTuong = doiTuong === 'Rạp' ? 'Rạp' : 'Phim';
            const pool = await getPool();

            // Kiểm tra ràng buộc khóa ngoại FK_DG_HD_KH (Hóa đơn thuộc về khách hàng)
            const checkInvoice = await pool.request()
                .input('khId', sql.Int, parseInt(maKhachHang))
                .input('hdId', sql.Int, parseInt(maHoaDon))
                .query(`
                    SELECT TOP 1 hd.MaHoaDon, sc.MaPhim, pc.MaRap
                    FROM dbo.HoaDon hd
                    JOIN dbo.Ve v ON hd.MaHoaDon = v.MaHoaDon
                    JOIN dbo.SuatChieu sc ON v.MaSuat = sc.MaSuat
                    JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                    WHERE hd.MaKhachHang = @khId AND hd.MaHoaDon = @hdId
                `);

            if (checkInvoice.recordset.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Hóa đơn không hợp lệ hoặc không thuộc về tài khoản này!"
                });
            }

            const inv = checkInvoice.recordset[0];
            const maPhim = cleanDoiTuong === 'Phim' ? inv.MaPhim : null;
            const maRap = cleanDoiTuong === 'Rạp' ? inv.MaRap : null;
            const maDoiTuong = cleanDoiTuong === 'Phim' ? inv.MaPhim : inv.MaRap;

            // Kiểm tra xem đã có đánh giá cho (MaKhachHang, MaHoaDon, DoiTuong) chưa
            const checkExist = await pool.request()
                .input('khId', sql.Int, parseInt(maKhachHang))
                .input('hdId', sql.Int, parseInt(maHoaDon))
                .input('doiTuong', sql.NVarChar(10), cleanDoiTuong)
                .query(`
                    SELECT 1 FROM dbo.DanhGia 
                    WHERE MaKhachHang = @khId AND MaHoaDon = @hdId AND DoiTuong = @doiTuong
                `);

            if (checkExist.recordset.length > 0) {
                // Cập nhật đánh giá đã có
                await pool.request()
                    .input('khId', sql.Int, parseInt(maKhachHang))
                    .input('hdId', sql.Int, parseInt(maHoaDon))
                    .input('doiTuong', sql.NVarChar(10), cleanDoiTuong)
                    .input('diem', sql.Int, diemNum)
                    .input('noiDung', sql.NVarChar(1000), noiDung.trim())
                    .query(`
                        UPDATE dbo.DanhGia
                        SET Diem = @diem, NoiDung = @noiDung
                        WHERE MaKhachHang = @khId AND MaHoaDon = @hdId AND DoiTuong = @doiTuong
                    `);
            } else {
                // Thêm mới đánh giá
                await pool.request()
                    .input('khId', sql.Int, parseInt(maKhachHang))
                    .input('hdId', sql.Int, parseInt(maHoaDon))
                    .input('doiTuong', sql.NVarChar(10), cleanDoiTuong)
                    .input('diem', sql.Int, diemNum)
                    .input('noiDung', sql.NVarChar(1000), noiDung.trim())
                    .input('maPhim', sql.Int, maPhim)
                    .input('maRap', sql.Int, maRap)
                    .input('maDoiTuong', sql.Int, maDoiTuong)
                    .query(`
                        INSERT INTO dbo.DanhGia (MaKhachHang, MaHoaDon, DoiTuong, Diem, NoiDung, MaPhim, MaRap, MaDoiTuong)
                        VALUES (@khId, @hdId, @doiTuong, @diem, @noiDung, @maPhim, @maRap, @maDoiTuong)
                    `);
            }

            res.status(201).json({
                success: true,
                message: "Gửi đánh giá thành công! Cảm ơn bạn đã đóng góp ý kiến."
            });
        } catch (error) {
            console.error('Lỗi addReview:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = reviewController;
