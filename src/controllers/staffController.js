// Controller Phân Hệ Quản Trị & Nghiệp Vụ Nhân Viên (Staff Subsystem)
const { getPool, sql } = require('../config/db');

const staffController = {
    // ==========================================
    // 1. THỐNG KÊ TỔNG QUAN (DASHBOARD METRICS)
    // ==========================================
    getDashboardOverview: async (req, res) => {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT 
                    (SELECT COUNT(*) FROM dbo.Phim) AS TongPhim,
                    (SELECT COUNT(*) FROM dbo.SuatChieu WHERE GioBatDau >= GETDATE()) AS SuatChieuSapToi,
                    (SELECT COUNT(*) FROM dbo.Ve WHERE TrangThai = N'Đã thanh toán') AS TongVeDaBan,
                    (SELECT ISNULL(SUM(GiaVe), 0) FROM dbo.Ve WHERE TrangThai = N'Đã thanh toán') AS TongDoanhThu,
                    (SELECT COUNT(*) FROM dbo.Ghe WHERE TinhTrangVatLy = N'Hỏng') AS TongGheHong,
                    (SELECT COUNT(*) FROM dbo.Coupon WHERE ThoiGianKetThuc >= GETDATE() AND (SoLuong IS NULL OR SoLuong > SoLuongDaDung)) AS CouponKhaDung
            `);
            res.status(200).json({ success: true, data: result.recordset[0] });
        } catch (error) {
            console.error('Lỗi getDashboardOverview:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // ==========================================
    // 2. QUẢN LÝ PHIM (CRUD MOVIE)
    // ==========================================
    // Thêm phim mới
    createMovie: async (req, res) => {
        try {
            const { tenPhim, thoiLuong, thoiDiemKhoiChieu, thoiDiemKetThuc, moTa, daoDien, dienVien, doTuoi, poster, trailer, theLoaiIds } = req.body;

            if (!tenPhim || !thoiLuong || !thoiDiemKhoiChieu || !moTa) {
                return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ tên phim, thời lượng, ngày khởi chiếu và mô tả!' });
            }

            const validDoTuoi = [0, 13, 16, 18].includes(parseInt(doTuoi)) ? parseInt(doTuoi) : 13;
            const pool = await getPool();

            const insertMovieRes = await pool.request()
                .input('tenPhim', sql.NVarChar(200), tenPhim.trim())
                .input('thoiLuong', sql.Int, parseInt(thoiLuong))
                .input('thoiDiemKhoiChieu', sql.Date, thoiDiemKhoiChieu)
                .input('thoiDiemKetThuc', sql.Date, thoiDiemKetThuc || null)
                .input('moTa', sql.NVarChar(sql.MAX), moTa.trim())
                .input('daoDien', sql.NVarChar(100), daoDien ? daoDien.trim() : null)
                .input('dienVien', sql.NVarChar(500), dienVien ? dienVien.trim() : null)
                .input('doTuoi', sql.Int, validDoTuoi)
                .input('poster', sql.NVarChar(500), poster ? poster.trim() : null)
                .input('trailer', sql.NVarChar(500), trailer ? trailer.trim() : null)
                .query(`
                    INSERT INTO dbo.Phim (TenPhim, ThoiLuong, ThoiDiemKhoiChieu, ThoiDiemKetThuc, MoTa, DaoDien, DienVien, DoTuoi, Poster, Trailer)
                    OUTPUT INSERTED.MaPhim
                    VALUES (@tenPhim, @thoiLuong, @thoiDiemKhoiChieu, @thoiDiemKetThuc, @moTa, @daoDien, @dienVien, @doTuoi, @poster, @trailer)
                `);

            const newMaPhim = insertMovieRes.recordset[0].MaPhim;

            // Thêm thể loại nếu có
            if (Array.isArray(theLoaiIds) && theLoaiIds.length > 0) {
                for (const tlId of theLoaiIds) {
                    await pool.request()
                        .input('maPhim', sql.Int, newMaPhim)
                        .input('maTheLoai', sql.Int, parseInt(tlId))
                        .query('INSERT INTO dbo.Phim_TheLoai (MaPhim, MaTheLoai) VALUES (@maPhim, @maTheLoai)');
                }
            }

            res.status(201).json({ success: true, message: `Thêm phim "${tenPhim}" thành công!`, maPhim: newMaPhim });
        } catch (error) {
            console.error('Lỗi createMovie:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Cập nhật phim
    updateMovie: async (req, res) => {
        try {
            const { id } = req.params;
            const { tenPhim, thoiLuong, thoiDiemKhoiChieu, thoiDiemKetThuc, moTa, daoDien, dienVien, doTuoi, poster, trailer, theLoaiIds } = req.body;

            const pool = await getPool();
            const validDoTuoi = [0, 13, 16, 18].includes(parseInt(doTuoi)) ? parseInt(doTuoi) : 13;

            await pool.request()
                .input('id', sql.Int, parseInt(id))
                .input('tenPhim', sql.NVarChar(200), tenPhim.trim())
                .input('thoiLuong', sql.Int, parseInt(thoiLuong))
                .input('thoiDiemKhoiChieu', sql.Date, thoiDiemKhoiChieu)
                .input('thoiDiemKetThuc', sql.Date, thoiDiemKetThuc || null)
                .input('moTa', sql.NVarChar(sql.MAX), moTa.trim())
                .input('daoDien', sql.NVarChar(100), daoDien ? daoDien.trim() : null)
                .input('dienVien', sql.NVarChar(500), dienVien ? dienVien.trim() : null)
                .input('doTuoi', sql.Int, validDoTuoi)
                .input('poster', sql.NVarChar(500), poster ? poster.trim() : null)
                .input('trailer', sql.NVarChar(500), trailer ? trailer.trim() : null)
                .query(`
                    UPDATE dbo.Phim
                    SET TenPhim = @tenPhim,
                        ThoiLuong = @thoiLuong,
                        ThoiDiemKhoiChieu = @thoiDiemKhoiChieu,
                        ThoiDiemKetThuc = @thoiDiemKetThuc,
                        MoTa = @moTa,
                        DaoDien = @daoDien,
                        DienVien = @dienVien,
                        DoTuoi = @doTuoi,
                        Poster = @poster,
                        Trailer = @trailer
                    WHERE MaPhim = @id
                `);

            if (Array.isArray(theLoaiIds)) {
                await pool.request().input('id', sql.Int, parseInt(id)).query('DELETE FROM dbo.Phim_TheLoai WHERE MaPhim = @id');
                for (const tlId of theLoaiIds) {
                    await pool.request()
                        .input('maPhim', sql.Int, parseInt(id))
                        .input('maTheLoai', sql.Int, parseInt(tlId))
                        .query('INSERT INTO dbo.Phim_TheLoai (MaPhim, MaTheLoai) VALUES (@maPhim, @maTheLoai)');
                }
            }

            res.status(200).json({ success: true, message: 'Cập nhật thông tin phim thành công!' });
        } catch (error) {
            console.error('Lỗi updateMovie:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Xóa phim
    deleteMovie: async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await getPool();

            // Kiểm tra xem phim đã có suất chiếu nào chưa
            const checkShowtimes = await pool.request()
                .input('id', sql.Int, parseInt(id))
                .query('SELECT COUNT(*) AS c FROM dbo.SuatChieu WHERE MaPhim = @id');

            if (checkShowtimes.recordset[0].c > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể xóa phim này vì đã có lịch suất chiếu liên kết trong CSDL!'
                });
            }

            // Xóa liên kết thể loại và xóa phim
            await pool.request().input('id', sql.Int, parseInt(id)).query(`
                DELETE FROM dbo.Phim_TheLoai WHERE MaPhim = @id;
                DELETE FROM dbo.DanhGia WHERE MaPhim = @id;
                DELETE FROM dbo.Phim WHERE MaPhim = @id;
            `);

            res.status(200).json({ success: true, message: 'Đã xóa phim thành công khỏi hệ thống!' });
        } catch (error) {
            console.error('Lỗi deleteMovie:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // ==========================================
    // 3. QUẢN LÝ SUẤT CHIẾU & KIỂM TRA TRIGGER
    // ==========================================
    // Lấy danh sách suất chiếu cho nhân viên quản lý
    getStaffShowtimes: async (req, res) => {
        try {
            const { roomId, movieId, date } = req.query;
            const pool = await getPool();
            const reqQuery = pool.request();
            const whereList = [];

            if (roomId) {
                reqQuery.input('roomId', sql.Int, parseInt(roomId));
                whereList.push('sc.MaPhong = @roomId');
            }
            if (movieId) {
                reqQuery.input('movieId', sql.Int, parseInt(movieId));
                whereList.push('sc.MaPhim = @movieId');
            }
            if (date) {
                reqQuery.input('date', sql.Date, date);
                whereList.push('CAST(sc.GioBatDau AS DATE) = @date');
            }

            const whereSql = whereList.length > 0 ? `WHERE ${whereList.join(' AND ')}` : '';

            const result = await reqQuery.query(`
                SELECT TOP 100
                    sc.MaSuat,
                    sc.MaPhim,
                    p.TenPhim,
                    p.ThoiLuong,
                    r.TenRap,
                    pc.MaPhong,
                    pc.TenPhong,
                    pc.CongNgheHoTro,
                    pc.PhuPhiCongNghe,
                    CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS GioBatDau,
                    CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS GioKetThuc,
                    sc.GiaVeCoBan,
                    (SELECT COUNT(*) FROM dbo.Ve v WHERE v.MaSuat = sc.MaSuat AND v.TrangThai = N'Đã thanh toán') AS SoVeDaBan,
                    pc.SoLuongGhe AS TongGhe
                FROM dbo.SuatChieu sc
                JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                ${whereSql}
                ORDER BY sc.GioBatDau DESC
            `);

            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getStaffShowtimes:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lập lịch suất chiếu mới (Có kích hoạt Trigger dbo.trg_LichChieu_KhongChongCheo)
    createShowtime: async (req, res) => {
        try {
            const { maPhim, maPhong, gioBatDau, gioKetThuc, giaVeCoBan } = req.body;

            if (!maPhim || !maPhong || !gioBatDau || !gioKetThuc || giaVeCoBan === undefined) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin: Phim, Phòng chiếu, Giờ bắt đầu, Giờ kết thúc và Giá vé!' });
            }

            const start = new Date(gioBatDau);
            const end = new Date(gioKetThuc);
            if (end <= start) {
                return res.status(400).json({ success: false, message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu suất chiếu!' });
            }

            const pool = await getPool();

            // Thực thi INSERT -> Nếu trùng thời gian cùng phòng, Trigger trg_LichChieu_KhongChongCheo sẽ tự động ROLLBACK và ném lỗi
            const insertRes = await pool.request()
                .input('maPhim', sql.Int, parseInt(maPhim))
                .input('maPhong', sql.Int, parseInt(maPhong))
                .input('gioBatDau', sql.DateTime2, gioBatDau)
                .input('gioKetThuc', sql.DateTime2, gioKetThuc)
                .input('giaVeCoBan', sql.Decimal(12, 0), Number(giaVeCoBan))
                .query(`
                    INSERT INTO dbo.SuatChieu (MaPhim, MaPhong, GioBatDau, GioKetThuc, GiaVeCoBan)
                    VALUES (@maPhim, @maPhong, @gioBatDau, @gioKetThuc, @giaVeCoBan);
                    SELECT SCOPE_IDENTITY() AS MaSuat;
                `);

            res.status(201).json({
                success: true,
                message: 'Lập lịch suất chiếu mới thành công!',
                maSuat: insertRes.recordset[0]?.MaSuat
            });
        } catch (error) {
            console.error('Lỗi createShowtime (Trigger check):', error.message);
            
            // Bắt lỗi ném ra từ Trigger trg_LichChieu_KhongChongCheo
            let isTriggerConflict = false;
            if (error.message && error.message.includes('Lịch chiếu bị trùng')) {
                isTriggerConflict = true;
            } else if (Array.isArray(error.precedingErrors)) {
                const found = error.precedingErrors.find(e => e.message && e.message.includes('Lịch chiếu bị trùng'));
                if (found) isTriggerConflict = true;
            } else if (error.message && error.message.includes('The transaction ended in the trigger')) {
                isTriggerConflict = true;
            }

            if (isTriggerConflict) {
                return res.status(409).json({
                    success: false,
                    isTriggerConflict: true,
                    message: '⚠️ [Trigger CSDL Chặn]: Lịch chiếu bị trùng! Phòng chiếu này đã có suất chiếu khác đang diễn ra trong khoảng thời gian trên.'
                });
            }
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Xóa suất chiếu
    deleteShowtime: async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await getPool();

            // Kiểm tra xem đã có vé đặt cho suất này chưa
            const checkTickets = await pool.request()
                .input('id', sql.Int, parseInt(id))
                .query('SELECT COUNT(*) AS c FROM dbo.Ve WHERE MaSuat = @id AND TrangThai <> N\'Đã hủy\'');

            if (checkTickets.recordset[0].c > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể xóa suất chiếu này vì đã có khách hàng mua/giữ vé!'
                });
            }

            await pool.request().input('id', sql.Int, parseInt(id)).query('DELETE FROM dbo.SuatChieu WHERE MaSuat = @id');
            res.status(200).json({ success: true, message: 'Đã xóa suất chiếu thành công!' });
        } catch (error) {
            console.error('Lỗi deleteShowtime:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // ==========================================
    // 4. SOÁT VÉ & CHECK-IN THEO HÓA ĐƠN (INVOICE CHECK-IN)
    // ==========================================
    // Chỉ cho phép soát vé theo Mã Hóa Đơn
    searchTicketForCheckIn: async (req, res) => {
        try {
            const { keyword, invoiceId } = req.query; // Chỉ chấp nhận Mã Hóa Đơn
            const rawId = invoiceId || keyword;
            if (!rawId) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã hóa đơn để soát vé!' });
            }

            const cleanKey = rawId.toString().trim().replace(/^#|HD/gi, '');
            const maHoaDon = parseInt(cleanKey, 10);

            if (isNaN(maHoaDon) || maHoaDon <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Mã hóa đơn không hợp lệ! Vui lòng chỉ nhập số hóa đơn (Ví dụ: 12, HD12, #HD12).'
                });
            }

            const pool = await getPool();

            // 1. Kiểm tra hóa đơn
            const hdRes = await pool.request()
                .input('maHd', sql.Int, maHoaDon)
                .query(`
                    SELECT 
                        hd.MaHoaDon,
                        hd.TrangThai AS TrangThaiHoaDon,
                        CONVERT(VARCHAR(19), hd.ThoiDiemLap, 120) AS ThoiDiemLap,
                        ISNULL(hd.TienGiam, 0) AS TienGiam,
                        hd.PhuongThucThanhToan,
                        kh.MaKhachHang,
                        kh.HoTen AS TenKhachHang,
                        kh.SoDienThoai AS SDTKhach,
                        nv.HoTen AS TenNhanVienLap,
                        (SELECT COUNT(*) FROM dbo.Ve v WHERE v.MaHoaDon = hd.MaHoaDon) AS TongSoVe,
                        (SELECT COUNT(*) FROM dbo.Ve v WHERE v.MaHoaDon = hd.MaHoaDon AND v.DaSoatVe = 1) AS SoVeDaSoat,
                        (SELECT ISNULL(SUM(GiaVe), 0) FROM dbo.Ve v WHERE v.MaHoaDon = hd.MaHoaDon) AS TongTienVe
                    FROM dbo.HoaDon hd
                    JOIN dbo.KhachHang kh ON hd.MaKhachHang = kh.MaKhachHang
                    LEFT JOIN dbo.NhanVien nv ON hd.MaNhanVien = nv.MaNhanVien
                    WHERE hd.MaHoaDon = @maHd
                `);

            if (hdRes.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Không tìm thấy hóa đơn #HD${maHoaDon} trong hệ thống!`
                });
            }

            const hoaDonInfo = hdRes.recordset[0];

            // 2. Lấy danh sách toàn bộ vé thuộc hóa đơn này
            const result = await pool.request()
                .input('maHd', sql.Int, maHoaDon)
                .query(`
                    SELECT 
                        v.MaVe,
                        v.MaHoaDon,
                        v.GiaVe,
                        v.TrangThai AS TrangThaiVe,
                        ISNULL(v.DaSoatVe, 0) AS DaSoatVe,
                        CONVERT(VARCHAR(19), v.ThoiDiemSoatVe, 120) AS ThoiDiemSoatVe,
                        hd.TrangThai AS TrangThaiHoaDon,
                        CONVERT(VARCHAR(19), hd.ThoiDiemLap, 120) AS ThoiDiemLap,
                        kh.MaKhachHang,
                        kh.HoTen AS TenKhachHang,
                        kh.SoDienThoai AS SDTKhach,
                        p.MaPhim,
                        p.TenPhim,
                        p.Poster,
                        p.DoTuoi,
                        r.TenRap,
                        pc.TenPhong,
                        pc.CongNgheHoTro,
                        g.Hang + CAST(g.Cot AS VARCHAR) AS MaGheText,
                        g.LoaiGhe,
                        CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS GioBatDau,
                        CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS GioKetThuc
                    FROM dbo.Ve v
                    JOIN dbo.HoaDon hd ON v.MaHoaDon = hd.MaHoaDon
                    JOIN dbo.KhachHang kh ON hd.MaKhachHang = kh.MaKhachHang
                    JOIN dbo.SuatChieu sc ON v.MaSuat = sc.MaSuat
                    JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                    JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                    JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                    JOIN dbo.Ghe g ON v.MaGhe = g.MaGhe
                    WHERE v.MaHoaDon = @maHd
                    ORDER BY v.MaVe ASC
                `);

            res.status(200).json({
                success: true,
                invoice: hoaDonInfo,
                total: result.recordset.length,
                data: result.recordset
            });
        } catch (error) {
            console.error('Lỗi searchTicketForCheckIn:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Soát toàn bộ vé trong hóa đơn
    confirmInvoiceCheckIn: async (req, res) => {
        try {
            const { maHoaDon } = req.body;
            if (!maHoaDon) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã hóa đơn cần soát vé!' });
            }

            const pool = await getPool();
            const maHdNum = parseInt(maHoaDon, 10);

            const veRes = await pool.request()
                .input('maHd', sql.Int, maHdNum)
                .query(`
                    SELECT MaVe, TrangThai, ISNULL(DaSoatVe, 0) AS DaSoatVe 
                    FROM dbo.Ve 
                    WHERE MaHoaDon = @maHd
                `);

            if (veRes.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Hóa đơn không có vé nào!' });
            }

            const unchekedTickets = veRes.recordset.filter(v => !v.DaSoatVe && v.TrangThai === 'Đã thanh toán');

            if (unchekedTickets.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tất cả các vé trong hóa đơn này đã được soát vé trước đó rồi!'
                });
            }

            await pool.request()
                .input('maHd', sql.Int, maHdNum)
                .query(`
                    UPDATE dbo.Ve 
                    SET DaSoatVe = 1, ThoiDiemSoatVe = SYSDATETIME() 
                    WHERE MaHoaDon = @maHd AND ISNULL(DaSoatVe, 0) = 0 AND TrangThai = N'Đã thanh toán'
                `);

            res.status(200).json({
                success: true,
                message: `✅ Đã soát vé thành công ${unchekedTickets.length} vé cho Hóa đơn #HD${maHdNum}!`
            });
        } catch (error) {
            console.error('Lỗi confirmInvoiceCheckIn:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Thực hiện soát vé (Check-in vé vào rạp)
    confirmCheckIn: async (req, res) => {
        try {
            const { maVe } = req.body;
            if (!maVe) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã vé cần soát!' });
            }

            const pool = await getPool();

            // Kiểm tra vé
            const checkRes = await pool.request()
                .input('maVe', sql.Int, parseInt(maVe))
                .query(`
                    SELECT v.MaVe, v.TrangThai, ISNULL(v.DaSoatVe, 0) AS DaSoatVe,
                           CONVERT(VARCHAR(19), v.ThoiDiemSoatVe, 120) AS ThoiDiemSoatVe
                    FROM dbo.Ve v WHERE v.MaVe = @maVe
                `);

            if (checkRes.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin vé!' });
            }

            const ticket = checkRes.recordset[0];
            if (ticket.TrangThai !== 'Đã thanh toán') {
                return res.status(400).json({
                    success: false,
                    message: `Vé này đang ở trạng thái "${ticket.TrangThai}", không hợp lệ để vào rạp!`
                });
            }

            if (ticket.DaSoatVe) {
                return res.status(409).json({
                    success: false,
                    alreadyCheckedIn: true,
                    message: `⚠️ Cảnh báo: Vé #${ticket.MaVe} ĐÃ ĐƯỢC SOÁT VÉ trước đó vào lúc ${ticket.ThoiDiemSoatVe}!`
                });
            }

            // Cập nhật check-in
            await pool.request()
                .input('maVe', sql.Int, parseInt(maVe))
                .query(`
                    UPDATE dbo.Ve 
                    SET DaSoatVe = 1, ThoiDiemSoatVe = SYSDATETIME() 
                    WHERE MaVe = @maVe
                `);

            res.status(200).json({
                success: true,
                message: `✅ Soát vé thành công cho Vé #${maVe}! Khách hàng hợp lệ vào rạp.`
            });
        } catch (error) {
            console.error('Lỗi confirmCheckIn:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // ==========================================
    // 5. QUẢN LÝ PHÒNG CHIẾU & GHẾ HỎNG (ROOMS & SEATS)
    // ==========================================
    // Lấy thông tin phòng và danh sách ghế
    getRoomSeatsForStaff: async (req, res) => {
        try {
            const { roomId } = req.params;
            const pool = await getPool();

            const roomInfo = await pool.request()
                .input('roomId', sql.Int, parseInt(roomId))
                .query(`
                    SELECT pc.*, r.TenRap 
                    FROM dbo.PhongChieu pc 
                    JOIN dbo.Rap r ON pc.MaRap = r.MaRap 
                    WHERE pc.MaPhong = @roomId
                `);

            if (roomInfo.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy phòng chiếu!' });
            }

            const seatsRes = await pool.request()
                .input('roomId', sql.Int, parseInt(roomId))
                .query(`
                    SELECT MaGhe, MaPhong, Hang, Cot, LoaiGhe, TinhTrangVatLy, PhuPhiViTri
                    FROM dbo.Ghe
                    WHERE MaPhong = @roomId
                    ORDER BY Hang ASC, Cot ASC
                `);

            res.status(200).json({
                success: true,
                room: roomInfo.recordset[0],
                seats: seatsRes.recordset
            });
        } catch (error) {
            console.error('Lỗi getRoomSeatsForStaff:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Cập nhật tình trạng ghế (Tốt <-> Hỏng)
    updateSeatCondition: async (req, res) => {
        try {
            const { maGhe, tinhTrangVatLy } = req.body;
            if (!maGhe || !['Tốt', 'Hỏng'].includes(tinhTrangVatLy)) {
                return res.status(400).json({ success: false, message: 'Tình trạng vật lý phải là "Tốt" hoặc "Hỏng"!' });
            }

            const pool = await getPool();
            await pool.request()
                .input('maGhe', sql.Int, parseInt(maGhe))
                .input('tt', sql.NVarChar(20), tinhTrangVatLy)
                .query('UPDATE dbo.Ghe SET TinhTrangVatLy = @tt WHERE MaGhe = @maGhe');

            res.status(200).json({
                success: true,
                message: `Đã cập nhật tình trạng ghế #${maGhe} thành "${tinhTrangVatLy}"!`
            });
        } catch (error) {
            console.error('Lỗi updateSeatCondition:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // ==========================================
    // 6. QUẢN LÝ MÃ GIẢM GIÁ COUPON (CRUD COUPON)
    // ==========================================
    getCouponsList: async (req, res) => {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT 
                    MaCoupon, TenChuongTrinh, LoaiGiamGia, GiaTriGiam,
                    GiaTriHoaDonToiThieu, GiamToiDa,
                    CONVERT(VARCHAR(19), ThoiGianBatDau, 120) AS ThoiGianBatDau,
                    CONVERT(VARCHAR(19), ThoiGianKetThuc, 120) AS ThoiGianKetThuc,
                    SoLuong, SoLuongDaDung,
                    (SoLuong - SoLuongDaDung) AS SoLuongConLai,
                    CASE 
                        WHEN ThoiGianKetThuc < GETDATE() THEN N'Hết hạn'
                        WHEN SoLuongDaDung >= SoLuong THEN N'Hết lượt dùng'
                        ELSE N'Đang kích hoạt'
                    END AS TrangThaiHienTai
                FROM dbo.Coupon
                ORDER BY ThoiGianBatDau DESC
            `);
            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getCouponsList:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    createCoupon: async (req, res) => {
        try {
            const { maCoupon, tenChuongTrinh, loaiGiamGia, giaTriGiam, giaTriHoaDonToiThieu, giamToiDa, thoiGianBatDau, thoiGianKetThuc, soLuong } = req.body;

            if (!maCoupon || !tenChuongTrinh || !loaiGiamGia || !giaTriGiam || !thoiGianBatDau || !thoiGianKetThuc || !soLuong) {
                return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các trường bắt buộc của mã giảm giá!' });
            }

            const cleanCode = maCoupon.trim().toUpperCase();
            const pool = await getPool();

            // Kiểm tra trùng mã
            const existCheck = await pool.request()
                .input('code', sql.VarChar(30), cleanCode)
                .query('SELECT 1 FROM dbo.Coupon WHERE MaCoupon = @code');

            if (existCheck.recordset.length > 0) {
                return res.status(400).json({ success: false, message: `Mã giảm giá "${cleanCode}" đã tồn tại!` });
            }

            await pool.request()
                .input('code', sql.VarChar(30), cleanCode)
                .input('ten', sql.NVarChar(200), tenChuongTrinh.trim())
                .input('loai', sql.NVarChar(20), loaiGiamGia === 'Phần trăm' ? 'Phần trăm' : 'Số tiền')
                .input('giaTri', sql.Decimal(18, 2), Number(giaTriGiam))
                .input('toiThieu', sql.Decimal(18, 2), Number(giaTriHoaDonToiThieu || 0))
                .input('toiDa', sql.Decimal(18, 2), giamToiDa ? Number(giamToiDa) : null)
                .input('batDau', sql.DateTime2, thoiGianBatDau)
                .input('ketThuc', sql.DateTime2, thoiGianKetThuc)
                .input('soLuong', sql.Int, parseInt(soLuong))
                .query(`
                    INSERT INTO dbo.Coupon (MaCoupon, TenChuongTrinh, LoaiGiamGia, GiaTriGiam, GiaTriHoaDonToiThieu, GiamToiDa, ThoiGianBatDau, ThoiGianKetThuc, SoLuong, SoLuongDaDung)
                    VALUES (@code, @ten, @loai, @giaTri, @toiThieu, @toiDa, @batDau, @ketThuc, @soLuong, 0)
                `);

            res.status(201).json({ success: true, message: `Tạo mã giảm giá "${cleanCode}" thành công!` });
        } catch (error) {
            console.error('Lỗi createCoupon:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    deleteCoupon: async (req, res) => {
        try {
            const { code } = req.params;
            const pool = await getPool();

            // Kiểm tra xem coupon đã từng được dùng trong hóa đơn nào chưa
            const checkUsed = await pool.request()
                .input('code', sql.VarChar(30), code.trim().toUpperCase())
                .query('SELECT COUNT(*) AS c FROM dbo.HoaDon WHERE MaCoupon = @code');

            if (checkUsed.recordset[0].c > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Không thể xóa mã voucher "${code}" vì đã có ${checkUsed.recordset[0].c} hóa đơn từng sử dụng mã này!`
                });
            }

            await pool.request()
                .input('code', sql.VarChar(30), code.trim().toUpperCase())
                .query('DELETE FROM dbo.Coupon WHERE MaCoupon = @code');

            res.status(200).json({ success: true, message: `Đã xóa mã voucher "${code}"!` });
        } catch (error) {
            console.error('Lỗi deleteCoupon:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // =========================================================================
    // 7. TRANG THỐNG KÊ TOÀN DIỆN (TÍCH HỢP 5 CÂU TRUY VẤN BTL: Q5, Q6, Q7, Q9, Q10)
    // =========================================================================
    getBTLReports: async (req, res) => {
        try {
            const pool = await getPool();

            // Q5: Top khách hàng có tổng chi tiêu cao nhất (Hóa đơn đã thanh toán)
            const q5Promise = pool.request().query(`
                SELECT TOP (10)
                    kh.MaKhachHang,
                    kh.HoTen,
                    kh.SoDienThoai,
                    kh.Email,
                    COUNT(DISTINCT hd.MaHoaDon) AS SoHoaDon,
                    COUNT(v.MaVe) AS TongSoVe,
                    SUM(v.GiaVe) AS TongChiTieu
                FROM dbo.KhachHang kh
                JOIN dbo.HoaDon hd ON kh.MaKhachHang = hd.MaKhachHang
                JOIN dbo.Ve v ON hd.MaHoaDon = v.MaHoaDon
                WHERE hd.TrangThai = N'Đã thanh toán'
                GROUP BY kh.MaKhachHang, kh.HoTen, kh.SoDienThoai, kh.Email
                ORDER BY TongChiTieu DESC
            `);

            // Q6: Thống kê doanh thu và số vé đã bán theo từng rạp
            const q6Promise = pool.request().query(`
                SELECT 
                    r.MaRap,
                    r.TenRap,
                    r.DiaChi,
                    r.Tinh,
                    COUNT(v.MaVe) AS SoVeDaBan,
                    ISNULL(SUM(v.GiaVe), 0) AS DoanhThu
                FROM dbo.Rap r
                LEFT JOIN dbo.PhongChieu pc ON pc.MaRap = r.MaRap
                LEFT JOIN dbo.SuatChieu sc ON sc.MaPhong = pc.MaPhong
                LEFT JOIN dbo.Ve v ON v.MaSuat = sc.MaSuat AND v.TrangThai = N'Đã thanh toán'
                GROUP BY r.MaRap, r.TenRap, r.DiaChi, r.Tinh
                ORDER BY DoanhThu DESC
            `);

            // Q7: Phim có số vé bán ra cao hơn mức trung bình của tất cả các phim
            const q7Promise = pool.request().query(`
                SELECT 
                    p.MaPhim,
                    p.TenPhim,
                    p.Poster,
                    p.DoTuoi,
                    COUNT(*) AS SoVeBan,
                    (SELECT CAST(AVG(x.SoVe * 1.0) AS DECIMAL(6,2))
                     FROM (SELECT COUNT(*) AS SoVe
                           FROM dbo.Ve v2
                           JOIN dbo.SuatChieu sc2 ON sc2.MaSuat = v2.MaSuat
                           WHERE v2.TrangThai = N'Đã thanh toán'
                           GROUP BY sc2.MaPhim) x) AS MucTrungBinh
                FROM dbo.Ve v
                JOIN dbo.SuatChieu sc ON sc.MaSuat = v.MaSuat
                JOIN dbo.Phim p ON p.MaPhim = sc.MaPhim
                WHERE v.TrangThai = N'Đã thanh toán'
                GROUP BY p.MaPhim, p.TenPhim, p.Poster, p.DoTuoi
                HAVING COUNT(*) > (SELECT AVG(x.SoVe * 1.0)
                                   FROM (SELECT COUNT(*) AS SoVe
                                         FROM dbo.Ve v2
                                         JOIN dbo.SuatChieu sc2 ON sc2.MaSuat = v2.MaSuat
                                         WHERE v2.TrangThai = N'Đã thanh toán'
                                         GROUP BY sc2.MaPhim) x)
                ORDER BY SoVeBan DESC
            `);

            // Q9: Thống kê tình trạng ghế tốt/hỏng theo từng phòng chiếu
            const q9Promise = pool.request().query(`
                SELECT 
                    r.TenRap,
                    pc.MaPhong,
                    pc.TenPhong,
                    pc.CongNgheHoTro,
                    COUNT(g.MaGhe) AS TongGhe,
                    SUM(CASE WHEN g.TinhTrangVatLy = N'Tốt' THEN 1 ELSE 0 END) AS GheTot,
                    SUM(CASE WHEN g.TinhTrangVatLy = N'Hỏng' THEN 1 ELSE 0 END) AS GheHong,
                    CAST(SUM(CASE WHEN g.TinhTrangVatLy = N'Hỏng' THEN 1.0 ELSE 0.0 END) * 100 / NULLIF(COUNT(g.MaGhe), 0) AS DECIMAL(5,1)) AS TyLeHong
                FROM dbo.PhongChieu pc
                JOIN dbo.Rap r ON r.MaRap = pc.MaRap
                JOIN dbo.Ghe g ON g.MaPhong = pc.MaPhong
                GROUP BY r.TenRap, pc.MaPhong, pc.TenPhong, pc.CongNgheHoTro
                ORDER BY r.TenRap ASC, pc.TenPhong ASC
            `);

            // Q10: Điểm đánh giá trung bình của từng phim
            const q10Promise = pool.request().query(`
                SELECT 
                    p.MaPhim,
                    p.TenPhim,
                    p.Poster,
                    COUNT(*) AS SoDanhGia,
                    CAST(AVG(CAST(dg.Diem AS DECIMAL(4,2))) AS DECIMAL(4,2)) AS DiemTrungBinh
                FROM dbo.DanhGia dg
                JOIN dbo.Phim p ON p.MaPhim = dg.MaPhim
                WHERE dg.DoiTuong = N'Phim'
                GROUP BY p.MaPhim, p.TenPhim, p.Poster
                HAVING COUNT(*) >= 1
                ORDER BY DiemTrungBinh DESC, SoDanhGia DESC
            `);

            const [q5Res, q6Res, q7Res, q9Res, q10Res] = await Promise.all([
                q5Promise, q6Promise, q7Promise, q9Promise, q10Promise
            ]);

            res.status(200).json({
                success: true,
                data: {
                    q5_TopCustomers: q5Res.recordset,
                    q6_CinemaRevenue: q6Res.recordset,
                    q7_AboveAverageMovies: q7Res.recordset,
                    q9_RoomSeatHealth: q9Res.recordset,
                    q10_MovieRatingAverage: q10Res.recordset
                }
            });
        } catch (error) {
            console.error('Lỗi getBTLReports:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // ==========================================
    // 8. NGHIỆP VỤ BÁN VÉ TẠI QUẦY (POS COUNTER BOOKING)
    // ==========================================
    // Tìm kiếm phim theo tên khi nhân viên nhập phục vụ bán vé tại quầy
    getPosMovies: async (req, res) => {
        try {
            const { search } = req.query;
            if (!search || !search.trim()) {
                return res.status(200).json({ success: true, total: 0, data: [] });
            }

            const pool = await getPool();
            const result = await pool.request()
                .input('search', sql.NVarChar(100), `%${search.trim()}%`)
                .query(`
                    SELECT 
                        p.MaPhim, p.TenPhim, p.ThoiLuong, p.DoTuoi, p.Poster,
                        (SELECT COUNT(*) FROM dbo.SuatChieu sc WHERE sc.MaPhim = p.MaPhim AND sc.GioBatDau >= GETDATE()) AS SoSuatChieu
                    FROM dbo.Phim p
                    WHERE p.TenPhim LIKE @search
                      AND EXISTS (SELECT 1 FROM dbo.SuatChieu sc WHERE sc.MaPhim = p.MaPhim AND sc.GioBatDau >= GETDATE())
                    ORDER BY p.TenPhim ASC
                `);

            res.status(200).json({ success: true, total: result.recordset.length, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getPosMovies:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy suất chiếu theo phim phục vụ bán vé tại quầy
    getPosShowtimes: async (req, res) => {
        try {
            const { movieId } = req.query;
            if (!movieId) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã phim!' });
            }
            const pool = await getPool();
            const result = await pool.request()
                .input('movieId', sql.Int, parseInt(movieId))
                .query(`
                    SELECT 
                        sc.MaSuat,
                        sc.MaPhim,
                        sc.MaPhong,
                        sc.GiaVeCoBan,
                        CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS GioBatDau,
                        CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS GioKetThuc,
                        pc.TenPhong,
                        pc.CongNgheHoTro,
                        ISNULL(pc.PhuPhiCongNghe, 0) AS PhuPhiCongNghe,
                        r.TenRap,
                        r.DiaChi,
                        (SELECT COUNT(*) FROM dbo.Ghe g WHERE g.MaPhong = pc.MaPhong AND g.TinhTrangVatLy = N'Tốt') AS TongGheTot,
                        (SELECT COUNT(*) FROM dbo.Ve v WHERE v.MaSuat = sc.MaSuat AND v.TrangThai = N'Đã thanh toán') AS SoVeDaBan
                    FROM dbo.SuatChieu sc
                    JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                    JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                    WHERE sc.MaPhim = @movieId AND sc.GioBatDau >= GETDATE()
                    ORDER BY sc.GioBatDau ASC
                `);
            res.status(200).json({ success: true, data: result.recordset });
        } catch (error) {
            console.error('Lỗi getPosShowtimes:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy sơ đồ ghế kèm trạng thái và tính giá vé cho suất chiếu
    getPosSeatMap: async (req, res) => {
        try {
            const { showtimeId } = req.query;
            if (!showtimeId) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã suất chiếu!' });
            }
            const pool = await getPool();
            const stRes = await pool.request()
                .input('showtimeId', sql.Int, parseInt(showtimeId))
                .query(`
                    SELECT 
                        sc.MaSuat, sc.GiaVeCoBan,
                        CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS GioBatDau,
                        CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS GioKetThuc,
                        p.MaPhim, p.TenPhim, p.DoTuoi, p.Poster,
                        pc.MaPhong, pc.TenPhong, pc.CongNgheHoTro, ISNULL(pc.PhuPhiCongNghe, 0) AS PhuPhiCongNghe,
                        r.TenRap
                    FROM dbo.SuatChieu sc
                    JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                    JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                    JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                    WHERE sc.MaSuat = @showtimeId
                `);

            if (stRes.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu!' });
            }

            const showtime = stRes.recordset[0];
            const giaCoBan = Number(showtime.GiaVeCoBan);
            const phuPhiCongNghe = Number(showtime.PhuPhiCongNghe);

            const seatsRes = await pool.request()
                .input('roomId', sql.Int, showtime.MaPhong)
                .input('showtimeId', sql.Int, parseInt(showtimeId))
                .input('giaCoBan', sql.Decimal(10, 2), giaCoBan)
                .input('phuPhiCongNghe', sql.Decimal(10, 2), phuPhiCongNghe)
                .query(`
                    SELECT 
                        g.MaGhe,
                        g.Hang,
                        g.Cot,
                        g.Hang + CAST(g.Cot AS VARCHAR) AS TenGhe,
                        g.LoaiGhe,
                        ISNULL(g.PhuPhiViTri, 0) AS PhuPhiViTri,
                        g.TinhTrangVatLy,
                        CASE 
                            WHEN g.TinhTrangVatLy = N'Hỏng' THEN 'broken'
                            WHEN v.TrangThai = N'Đã thanh toán' THEN 'booked'
                            WHEN v.TrangThai = N'Giữ chỗ' AND v.ThoiDiemDat >= DATEADD(MINUTE, -10, SYSDATETIME()) THEN 'holding'
                            ELSE 'available'
                        END AS TrangThaiGhe,
                        (@giaCoBan + @phuPhiCongNghe + ISNULL(g.PhuPhiViTri, 0)) AS GiaVeDuKien
                    FROM dbo.Ghe g
                    LEFT JOIN dbo.Ve v ON g.MaGhe = v.MaGhe AND v.MaSuat = @showtimeId AND v.TrangThai <> N'Đã hủy'
                    WHERE g.MaPhong = @roomId
                    ORDER BY g.Hang ASC, g.Cot ASC
                `);

            res.status(200).json({
                success: true,
                showtime,
                seats: seatsRes.recordset
            });
        } catch (error) {
            console.error('Lỗi getPosSeatMap:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Thực hiện đặt vé và thanh toán tại quầy
    createPosBooking: async (req, res) => {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        try {
            const { maSuat, danhSachMaGhe, soDienThoaiKhach, maCoupon, phuongThucThanhToan, maNhanVien } = req.body;

            if (!maSuat || !Array.isArray(danhSachMaGhe) || danhSachMaGhe.length === 0) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn suất chiếu và ít nhất một ghế!' });
            }

            // 1. Kiểm tra suất chiếu
            const stRes = await pool.request()
                .input('maSuat', sql.Int, parseInt(maSuat))
                .query(`
                    SELECT sc.MaSuat, sc.MaPhong, sc.GiaVeCoBan, pc.PhuPhiCongNghe, pc.TenPhong, p.TenPhim, r.TenRap,
                           CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS GioBatDau
                    FROM dbo.SuatChieu sc
                    JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                    JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                    JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                    WHERE sc.MaSuat = @maSuat
                `);

            if (stRes.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Suất chiếu không tồn tại!' });
            }
            const st = stRes.recordset[0];

            // 2. Xác định Khách hàng (Tự động liên kết theo SĐT hoặc dùng Khách Vãng Lai)
            let maKhachHang = 107; // Default Khách Vãng Lai Tại Quầy
            let tenKhach = 'Khách Vãng Lai Tại Quầy';
            let sdtKhach = '0999999999';

            if (soDienThoaiKhach && soDienThoaiKhach.trim()) {
                const cleanPhone = soDienThoaiKhach.trim();
                const findCust = await pool.request()
                    .input('phone', sql.VarChar(15), cleanPhone)
                    .query('SELECT MaKhachHang, HoTen, SoDienThoai FROM dbo.KhachHang WHERE SoDienThoai = @phone');

                if (findCust.recordset.length > 0) {
                    maKhachHang = findCust.recordset[0].MaKhachHang;
                    tenKhach = findCust.recordset[0].HoTen;
                    sdtKhach = findCust.recordset[0].SoDienThoai;
                } else {
                    const newCust = await pool.request()
                        .input('ten', sql.NVarChar(100), `Khách Hàng ${cleanPhone}`)
                        .input('phone', sql.VarChar(15), cleanPhone)
                        .query(`
                            INSERT INTO dbo.KhachHang (HoTen, SoDienThoai, NgaySinh, MatKhau)
                            OUTPUT INSERTED.MaKhachHang, INSERTED.HoTen, INSERTED.SoDienThoai
                            VALUES (@ten, @phone, '2000-01-01', '123456')
                        `);
                    maKhachHang = newCust.recordset[0].MaKhachHang;
                    tenKhach = newCust.recordset[0].HoTen;
                    sdtKhach = newCust.recordset[0].SoDienThoai;
                }
            }

            // 3. Tiền kiểm tra các ghế: Không bị hỏng và chưa bị bán/giữ chỗ
            const checkReq = pool.request().input('chkSuat', sql.Int, st.MaSuat);
            const inPlaceholders = danhSachMaGhe.map((id, idx) => {
                const pName = `chkGhe${idx}`;
                checkReq.input(pName, sql.Int, parseInt(id));
                return `@${pName}`;
            }).join(', ');

            const conflictSeats = await checkReq.query(`
                SELECT g.Hang + CAST(g.Cot AS VARCHAR) AS SeatCode
                FROM dbo.Ghe g
                LEFT JOIN dbo.Ve v ON v.MaGhe = g.MaGhe AND v.MaSuat = @chkSuat AND v.TrangThai <> N'Đã hủy'
                WHERE g.MaGhe IN (${inPlaceholders})
                  AND (
                      g.TinhTrangVatLy = N'Hỏng'
                      OR v.TrangThai = N'Đã thanh toán'
                      OR (v.TrangThai = N'Giữ chỗ' AND v.ThoiDiemDat >= DATEADD(MINUTE, -10, SYSDATETIME()))
                  )
            `);

            if (conflictSeats.recordset.length > 0) {
                const busyList = conflictSeats.recordset.map(r => r.SeatCode).join(', ');
                return res.status(409).json({
                    success: false,
                    message: `Một hoặc nhiều ghế đã bị người khác chọn hoặc đang hỏng: [${busyList}]!`
                });
            }

            // 4. Lấy chi tiết từng ghế để tính tiền
            const seatsDetails = await pool.request()
                .query(`SELECT MaGhe, Hang, Cot, LoaiGhe, ISNULL(PhuPhiViTri, 0) AS PhuPhiViTri FROM dbo.Ghe WHERE MaGhe IN (${danhSachMaGhe.map(id => parseInt(id)).join(',')})`);

            let tongTienVe = 0;
            const seatPriceMap = {};
            for (const s of seatsDetails.recordset) {
                const price = Number(st.GiaVeCoBan) + Number(st.PhuPhiCongNghe || 0) + Number(s.PhuPhiViTri || 0);
                seatPriceMap[s.MaGhe] = price;
                tongTienVe += price;
            }

            // 5. Tính giảm giá Coupon nếu có
            let tienGiam = 0;
            let couponObj = null;
            if (maCoupon && maCoupon.trim()) {
                const cleanCoupon = maCoupon.trim().toUpperCase();
                const cpRes = await pool.request()
                    .input('cp', sql.VarChar(30), cleanCoupon)
                    .query(`
                        SELECT * FROM dbo.Coupon 
                        WHERE MaCoupon = @cp 
                          AND (ThoiGianKetThuc IS NULL OR ThoiGianKetThuc >= GETDATE())
                          AND (SoLuong IS NULL OR SoLuong > SoLuongDaDung)
                    `);
                if (cpRes.recordset.length > 0) {
                    couponObj = cpRes.recordset[0];
                    if (!couponObj.GiaTriHoaDonToiThieu || tongTienVe >= couponObj.GiaTriHoaDonToiThieu) {
                        if (couponObj.LoaiGiamGia === 'Phần trăm') {
                            tienGiam = (tongTienVe * couponObj.GiaTriGiam) / 100;
                            if (couponObj.GiamToiDa && tienGiam > couponObj.GiamToiDa) {
                                tienGiam = Number(couponObj.GiamToiDa);
                            }
                        } else {
                            tienGiam = Number(couponObj.GiaTriGiam);
                        }
                        tienGiam = Math.min(Math.max(0, tienGiam), tongTienVe);
                    }
                }
            }

            const soTienThanhToan = Math.max(0, tongTienVe - tienGiam);
            const validPayment = ['Tiền mặt', 'Thẻ', 'Chuyển khoản', 'Ví điện tử'].includes(phuongThucThanhToan) 
                ? phuongThucThanhToan : 'Tiền mặt';

            // 6. Thực hiện Transaction tạo Hóa đơn và Vé
            await transaction.begin();

            const insertHdRes = await new sql.Request(transaction)
                .input('makh', sql.Int, maKhachHang)
                .input('manv', sql.Int, maNhanVien ? parseInt(maNhanVien) : null)
                .input('coupon', sql.VarChar(30), couponObj ? couponObj.MaCoupon : null)
                .input('tienGiam', sql.Decimal(10, 2), tienGiam)
                .input('pttt', sql.NVarChar(30), validPayment)
                .query(`
                    INSERT INTO dbo.HoaDon (MaKhachHang, MaNhanVien, MaCoupon, TienGiam, PhuongThucThanhToan, TrangThai, ThoiDiemLap)
                    OUTPUT INSERTED.MaHoaDon, CONVERT(VARCHAR(19), INSERTED.ThoiDiemLap, 120) AS ThoiDiemLap
                    VALUES (@makh, @manv, @coupon, @tienGiam, @pttt, N'Đã thanh toán', SYSDATETIME())
                `);

            const newMaHoaDon = insertHdRes.recordset[0].MaHoaDon;
            const thoiDiemLap = insertHdRes.recordset[0].ThoiDiemLap;

            const createdTickets = [];
            for (const s of seatsDetails.recordset) {
                const ticketPrice = seatPriceMap[s.MaGhe];
                const insertVeRes = await new sql.Request(transaction)
                    .input('maSuat', sql.Int, st.MaSuat)
                    .input('maGhe', sql.Int, s.MaGhe)
                    .input('maHd', sql.Int, newMaHoaDon)
                    .input('giaVe', sql.Decimal(10, 2), ticketPrice)
                    .query(`
                        INSERT INTO dbo.Ve (MaSuat, MaGhe, MaHoaDon, GiaVe, TrangThai, ThoiDiemDat, DaSoatVe)
                        OUTPUT INSERTED.MaVe
                        VALUES (@maSuat, @maGhe, @maHd, @giaVe, N'Đã thanh toán', SYSDATETIME(), 0)
                    `);

                createdTickets.push({
                    maVe: insertVeRes.recordset[0].MaVe,
                    maGhe: s.MaGhe,
                    hang: s.Hang,
                    cot: s.Cot,
                    soGhe: `${s.Hang}${s.Cot}`,
                    loaiGhe: s.LoaiGhe,
                    giaVe: ticketPrice
                });
            }

            if (couponObj) {
                await new sql.Request(transaction)
                    .input('cpCode', sql.VarChar(30), couponObj.MaCoupon)
                    .query('UPDATE dbo.Coupon SET SoLuongDaDung = SoLuongDaDung + 1 WHERE MaCoupon = @cpCode');
            }

            await transaction.commit();

            res.status(200).json({
                success: true,
                message: '🎉 Bán vé tại quầy thành công!',
                data: {
                    maHoaDon: newMaHoaDon,
                    thoiDiemLap: thoiDiemLap,
                    tenKhachHang: tenKhach,
                    soDienThoaiKhach: sdtKhach,
                    tenPhim: st.TenPhim,
                    tenPhong: st.TenPhong,
                    tenRap: st.TenRap,
                    gioBatDau: st.GioBatDau,
                    danhSachVe: createdTickets,
                    tongTienVe: tongTienVe,
                    tienGiam: tienGiam,
                    soTienThanhToan: soTienThanhToan,
                    phuongThucThanhToan: validPayment
                }
            });

        } catch (error) {
            if (transaction._begun) {
                await transaction.rollback();
            }
            console.error('Lỗi createPosBooking:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = staffController;
