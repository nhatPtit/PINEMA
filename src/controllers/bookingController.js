// Quản lý Đặt Vé, Vé, Hóa Đơn và Coupon - Kết nối CSDL RapPhim
const { getPool, sql } = require('../config/db');

// Chuẩn hóa phương thức thanh toán phù hợp với Check Constraint CK_HD_PT
function normalizePaymentMethod(method) {
    if (!method) return 'Chuyển khoản';
    const m = method.toLowerCase();
    if (m.includes('ví') || m.includes('momo') || m.includes('zalo') || m.includes('vnpay')) return 'Ví điện tử';
    if (m.includes('thẻ') || m.includes('card') || m.includes('visa') || m.includes('master')) return 'Thẻ';
    if (m.includes('tiền mặt') || m.includes('cash')) return 'Tiền mặt';
    return 'Chuyển khoản';
}

const bookingController = {
    // 1. Lấy danh sách Coupon còn khả dụng trong CSDL
    getAvailableCoupons: async (req, res) => {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT 
                    MaCoupon,
                    TenChuongTrinh,
                    LoaiGiamGia,
                    GiaTriGiam,
                    GiaTriHoaDonToiThieu,
                    GiamToiDa,
                    ThoiGianBatDau,
                    ThoiGianKetThuc,
                    SoLuong,
                    SoLuongDaDung,
                    (SoLuong - SoLuongDaDung) AS SoLuongConLai
                FROM dbo.Coupon
                WHERE (ThoiGianKetThuc IS NULL OR ThoiGianKetThuc >= GETDATE())
                  AND (SoLuong IS NULL OR SoLuong > SoLuongDaDung)
                ORDER BY ThoiGianKetThuc ASC
            `);
            res.status(200).json({
                success: true,
                message: "Lấy danh sách mã giảm giá thành công",
                total: result.recordset.length,
                data: result.recordset
            });
        } catch (error) {
            console.error('Lỗi getAvailableCoupons:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 2. Kiểm tra và áp dụng mã Coupon từ bảng Coupon
    validateCoupon: async (req, res) => {
        try {
            const { code, totalAmount } = req.body;
            if (!code) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã giảm giá' });
            }

            const pool = await getPool();
            const result = await pool.request()
                .input('code', sql.VarChar(30), code.trim().toUpperCase())
                .query(`
                    SELECT * FROM dbo.Coupon 
                    WHERE MaCoupon = @code 
                      AND (ThoiGianKetThuc IS NULL OR ThoiGianKetThuc >= GETDATE())
                      AND (SoLuong IS NULL OR SoLuong > SoLuongDaDung)
                `);

            if (result.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn/lượt dùng' });
            }

            const coupon = result.recordset[0];

            if (coupon.GiaTriHoaDonToiThieu && totalAmount < coupon.GiaTriHoaDonToiThieu) {
                return res.status(400).json({
                    success: false,
                    message: `Đơn hàng tối thiểu phải từ ${Number(coupon.GiaTriHoaDonToiThieu).toLocaleString('vi-VN')} VNĐ để áp dụng mã này`
                });
            }

            let discount = 0;
            if (coupon.LoaiGiamGia === 'Phần trăm') {
                discount = (totalAmount * coupon.GiaTriGiam) / 100;
                if (coupon.GiamToiDa && discount > coupon.GiamToiDa) {
                    discount = Number(coupon.GiamToiDa);
                }
            } else {
                discount = Number(coupon.GiaTriGiam);
            }

            // Đảm bảo tiền giảm không âm và không vượt quá giá trị đơn hàng
            discount = Math.min(Math.max(0, discount), totalAmount);
            const finalAmount = Math.max(0, totalAmount - discount);

            res.status(200).json({
                success: true,
                message: `Áp dụng thành công voucher "${coupon.TenChuongTrinh}"`,
                data: {
                    code: coupon.MaCoupon,
                    discount: discount,
                    finalAmount: finalAmount
                }
            });
        } catch (error) {
            console.error('Lỗi validateCoupon:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 3. Tạo đơn đặt vé mới (Gọi stored procedure sp_GiuCho an toàn và cập nhật HoaDon, Ve thật)
    createBooking: async (req, res) => {
        try {
            const { maSuat, danhSachGhe, maKhachHang, couponCode, phuongThucThanhToan } = req.body;

            if (!maKhachHang) {
                return res.status(401).json({
                    success: false,
                    requireLogin: true,
                    message: 'Bạn chưa đăng nhập! Vui lòng đăng nhập để tiếp tục đặt vé.'
                });
            }

            if (!danhSachGhe || !Array.isArray(danhSachGhe) || danhSachGhe.length === 0) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một ghế ngồi!' });
            }

            const pool = await getPool();

            // Xác thực khách hàng
            const checkUser = await pool.request()
                .input('makh', sql.Int, parseInt(maKhachHang))
                .query('SELECT MaKhachHang, HoTen, SoDienThoai, Email FROM dbo.KhachHang WHERE MaKhachHang = @makh');

            if (checkUser.recordset.length === 0) {
                return res.status(401).json({
                    success: false,
                    requireLogin: true,
                    message: 'Tài khoản khách hàng không tồn tại trong hệ thống!'
                });
            }

            const customer = checkUser.recordset[0];

            // Lấy thông tin suất chiếu và phòng chiếu
            const showtimeInfo = await pool.request()
                .input('maSuat', sql.Int, parseInt(maSuat))
                .query(`
                    SELECT sc.MaSuat, sc.MaPhong, sc.MaPhim, sc.GiaVeCoBan,
                           pc.TenPhong, pc.CongNgheHoTro, pc.PhuPhiCongNghe,
                           r.TenRap, r.DiaChi, p.TenPhim
                    FROM dbo.SuatChieu sc
                    JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                    JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                    JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                    WHERE sc.MaSuat = @maSuat
                `);

            if (showtimeInfo.recordset.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy suất chiếu yêu cầu!' });
            }

            const st = showtimeInfo.recordset[0];

            // Kiểm tra suất chiếu có còn trong tương lai không
            const timeCheckRes = await pool.request()
                .input('maSuat2', sql.Int, parseInt(maSuat))
                .query(`SELECT CASE WHEN GioBatDau > GETDATE() THEN 1 ELSE 0 END AS IsUpcoming FROM dbo.SuatChieu WHERE MaSuat = @maSuat2`);
            const isUpcoming = timeCheckRes.recordset[0]?.IsUpcoming;
            if (!isUpcoming) {
                return res.status(400).json({
                    success: false,
                    message: 'Suất chiếu này đã diễn ra, không thể đặt vé! Vui lòng chọn suất chiếu khác.'
                });
            }

            // Chuẩn hóa danh sách mã ghế: Chấp nhận cả số MaGhe lẫn chuỗi mã ghế 'A1', 'B2'
            const resolvedSeatIds = [];
            for (const item of danhSachGhe) {
                if (typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item))) {
                    resolvedSeatIds.push(parseInt(item));
                } else if (typeof item === 'object' && item.maGhe) {
                    resolvedSeatIds.push(parseInt(item.maGhe));
                } else if (typeof item === 'string') {
                    // Tách chữ cái hàng và số cột (ví dụ 'A1' -> Hang 'A', Cot 1)
                    const match = item.trim().match(/^([A-Za-z]+)(\d+)$/);
                    if (match) {
                        const hang = match[1].toUpperCase();
                        const cot = parseInt(match[2]);
                        const seatQuery = await pool.request()
                            .input('maPhong', sql.Int, st.MaPhong)
                            .input('hang', sql.Char(1), hang)
                            .input('cot', sql.Int, cot)
                            .query('SELECT MaGhe FROM dbo.Ghe WHERE MaPhong = @maPhong AND Hang = @hang AND Cot = @cot');
                        if (seatQuery.recordset.length > 0) {
                            resolvedSeatIds.push(seatQuery.recordset[0].MaGhe);
                        }
                    }
                }
            }

            if (resolvedSeatIds.length === 0) {
                return res.status(400).json({ success: false, message: 'Danh sách ghế không hợp lệ!' });
            }

            // 1. Dọn dẹp tự động các ghế giữ chỗ quá 10 phút và hóa đơn rác chưa hoàn tất
            try {
                await pool.request().query(`
                    DELETE FROM dbo.Ve 
                    WHERE TrangThai = N'Giữ chỗ' AND ThoiDiemDat < DATEADD(MINUTE, -10, SYSDATETIME());

                    DELETE FROM dbo.HoaDon
                    WHERE TrangThai = N'Chờ thanh toán'
                      AND ThoiDiemLap < DATEADD(MINUTE, -15, SYSDATETIME())
                      AND NOT EXISTS (SELECT 1 FROM dbo.Ve WHERE Ve.MaHoaDon = HoaDon.MaHoaDon AND Ve.TrangThai = N'Đã thanh toán');
                `);
            } catch (cleanupErr) {
                // Không ngắt luồng đặt vé nếu dọn dẹp nền gặp cảnh báo
            }

            // 2. Tiền kiểm tra: Tránh tạo hóa đơn rác nếu bất kỳ ghế nào đã bị giữ hoặc đang hỏng
            const checkReq = pool.request().input('chkSuat', sql.Int, st.MaSuat);
            const inPlaceholders = resolvedSeatIds.map((id, idx) => {
                const pName = `chkGhe${idx}`;
                checkReq.input(pName, sql.Int, id);
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
                    message: `Ghế [${busyList}] vừa được người khác giữ hoặc đang bảo trì. Vui lòng chọn ghế khác!`
                });
            }

            // 3. Gọi dbo.sp_GiuCho an toàn lần lượt cho từng ghế
            let maHoaDon = null;
            const heldSeatIds = [];

            try {
                for (const maGhe of resolvedSeatIds) {
                    const spReq = pool.request()
                        .input('MaKhachHang', sql.Int, customer.MaKhachHang)
                        .input('MaSuat', sql.Int, st.MaSuat)
                        .input('MaGhe', sql.Int, maGhe)
                        .input('MaNhanVien', sql.Int, null)
                        .output('MaHoaDon', sql.Int, maHoaDon);

                    const spRes = await spReq.execute('dbo.sp_GiuCho');
                    maHoaDon = spRes.output.MaHoaDon;
                    heldSeatIds.push(maGhe);
                }
            } catch (spErr) {
                console.error('Lỗi sp_GiuCho:', spErr);
                // Xóa hoàn toàn vé tạm và hóa đơn rác chưa thanh toán để CSDL sạch sẽ
                if (maHoaDon) {
                    try {
                        await pool.request()
                            .input('hdId', sql.Int, maHoaDon)
                            .query(`
                                DELETE FROM dbo.Ve WHERE MaHoaDon = @hdId AND TrangThai = N'Giữ chỗ';
                                DELETE FROM dbo.HoaDon WHERE MaHoaDon = @hdId AND TrangThai = N'Chờ thanh toán';
                            `);
                    } catch (delErr) {
                        console.error('Lỗi dọn rác hóa đơn:', delErr);
                    }
                }
                return res.status(409).json({
                    success: false,
                    message: spErr.message || 'Một trong các ghế bạn chọn vừa được người khác giữ hoặc không hợp lệ. Vui lòng chọn ghế khác!'
                });
            }

            // 4. Tính tổng tiền vé thực tế từ bảng Ve
            const totalTicketsRes = await pool.request()
                .input('hdId', sql.Int, maHoaDon)
                .query(`
                    SELECT ISNULL(SUM(GiaVe), 0) AS TongTienVe, COUNT(*) AS SoLuongVe
                    FROM dbo.Ve
                    WHERE MaHoaDon = @hdId AND TrangThai <> N'Đã hủy'
                `);

            const tongTienVe = Number(totalTicketsRes.recordset[0]?.TongTienVe || 0);
            let tienGiam = 0;
            let appliedCoupon = null;

            // 5. Xử lý giảm giá nếu có Coupon (Ngăn chặn tiền giảm âm hoặc vượt tổng vé)
            if (couponCode) {
                const cpRes = await pool.request()
                    .input('code', sql.VarChar(30), couponCode.trim().toUpperCase())
                    .query(`
                        SELECT * FROM dbo.Coupon 
                        WHERE MaCoupon = @code 
                          AND (ThoiGianKetThuc IS NULL OR ThoiGianKetThuc >= GETDATE())
                          AND (SoLuong IS NULL OR SoLuong > SoLuongDaDung)
                    `);

                if (cpRes.recordset.length > 0) {
                    const cp = cpRes.recordset[0];
                    if (!cp.GiaTriHoaDonToiThieu || tongTienVe >= cp.GiaTriHoaDonToiThieu) {
                        appliedCoupon = cp.MaCoupon;
                        if (cp.LoaiGiamGia === 'Phần trăm') {
                            tienGiam = (tongTienVe * cp.GiaTriGiam) / 100;
                            if (cp.GiamToiDa && tienGiam > cp.GiamToiDa) {
                                tienGiam = Number(cp.GiamToiDa);
                            }
                        } else {
                            tienGiam = Number(cp.GiaTriGiam);
                        }

                        // Đảm bảo không âm và không vượt quá tổng tiền vé
                        tienGiam = Math.min(Math.max(0, tienGiam), tongTienVe);

                        // Cập nhật tăng số lượt dùng coupon an toàn với ràng buộc số lượng
                        await pool.request()
                            .input('code', sql.VarChar(30), appliedCoupon)
                            .query('UPDATE dbo.Coupon SET SoLuongDaDung = SoLuongDaDung + 1 WHERE MaCoupon = @code AND SoLuongDaDung < SoLuong');
                    }
                }
            }

            // Đảm bảo tiền giảm và thanh toán triệt tiêu nguy cơ số tiền âm
            tienGiam = Math.min(Math.max(0, tienGiam), tongTienVe);
            const validPTTT = normalizePaymentMethod(phuongThucThanhToan);
            const soTienThanhToan = Math.max(0, tongTienVe - tienGiam);

            // Cập nhật trạng thái Hóa Đơn và Vé thành Đã thanh toán
            await pool.request()
                .input('hdId', sql.Int, maHoaDon)
                .input('pttt', sql.NVarChar(30), validPTTT)
                .input('maCoupon', sql.VarChar(30), appliedCoupon)
                .input('tienGiam', sql.Decimal(18, 2), tienGiam)
                .query(`
                    UPDATE dbo.HoaDon
                    SET TrangThai = N'Đã thanh toán',
                        PhuongThucThanhToan = @pttt,
                        MaCoupon = @maCoupon,
                        TienGiam = @tienGiam
                    WHERE MaHoaDon = @hdId;

                    UPDATE dbo.Ve
                    SET TrangThai = N'Đã thanh toán'
                    WHERE MaHoaDon = @hdId AND TrangThai = N'Giữ chỗ';
                `);

            // Lấy danh sách thông tin vé vừa tạo
            const seatCodesRes = await pool.request()
                .input('hdId', sql.Int, maHoaDon)
                .query(`
                    SELECT v.MaVe, v.GiaVe, g.Hang + CAST(g.Cot AS VARCHAR) AS MaGheText,
                           g.LoaiGhe, g.PhuPhiViTri
                    FROM dbo.Ve v
                    JOIN dbo.Ghe g ON v.MaGhe = g.MaGhe
                    WHERE v.MaHoaDon = @hdId AND v.TrangThai = N'Đã thanh toán'
                `);

            res.status(201).json({
                success: true,
                message: 'Đặt vé và thanh toán thành công!',
                data: {
                    maHoaDon: maHoaDon,
                    maSuat: st.MaSuat,
                    tenPhim: st.TenPhim,
                    tenRap: st.TenRap,
                    diaChi: st.DiaChi,
                    tenPhong: st.TenPhong,
                    congNghe: st.CongNgheHoTro,
                    khachHang: customer.HoTen,
                    soLuongVe: seatCodesRes.recordset.length,
                    danhSachGhe: seatCodesRes.recordset.map(r => r.MaGheText),
                    tongTienVe: tongTienVe,
                    tienGiam: tienGiam,
                    thanhToan: soTienThanhToan,
                    phuongThucThanhToan: validPTTT,
                    maCoupon: appliedCoupon,
                    thoiDiemLap: new Date()
                }
            });

        } catch (error) {
            console.error('Lỗi createBooking:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 4. Lấy lịch sử vé đã đặt của khách hàng (Kết nối dbo.HoaDon và vw_HoaDonTongTien)
    getBookingHistory: async (req, res) => {
        try {
            const { customerId } = req.params;
            const pool = await getPool();

            const query = `
                SELECT 
                    hd.MaHoaDon,
                    CONVERT(VARCHAR(19), hd.ThoiDiemLap, 120) AS ThoiDiemLap,
                    hd.TrangThai,
                    hd.PhuongThucThanhToan,
                    hd.TienGiam,
                    hd.MaCoupon,
                    p.MaPhim,
                    p.TenPhim,
                    p.Poster,
                    p.ThoiLuong,
                    p.DoTuoi,
                    r.MaRap,
                    r.TenRap,
                    pc.TenPhong,
                    pc.CongNgheHoTro,
                    CONVERT(VARCHAR(19), sc.GioBatDau, 120) AS GioBatDau,
                    CONVERT(VARCHAR(19), sc.GioKetThuc, 120) AS GioKetThuc,
                    COUNT(v.MaVe) AS SoLuongVe,
                    ISNULL(SUM(v.GiaVe), 0) AS TongTienVe,
                    CASE 
                        WHEN ISNULL(SUM(v.GiaVe), 0) <= hd.TienGiam THEN 0 
                        ELSE ISNULL(SUM(v.GiaVe), 0) - hd.TienGiam 
                    END AS ThanhToan,
                    STRING_AGG(g.Hang + CAST(g.Cot AS VARCHAR), ', ') WITHIN GROUP (ORDER BY g.Hang, g.Cot) AS DanhSachGheText,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM dbo.DanhGia dg 
                        WHERE dg.MaHoaDon = hd.MaHoaDon AND dg.DoiTuong = N'Phim'
                    ) THEN 1 ELSE 0 END AS DaDanhGiaPhim
                FROM dbo.HoaDon hd
                JOIN dbo.Ve v ON hd.MaHoaDon = v.MaHoaDon
                JOIN dbo.SuatChieu sc ON v.MaSuat = sc.MaSuat
                JOIN dbo.Phim p ON sc.MaPhim = p.MaPhim
                JOIN dbo.PhongChieu pc ON sc.MaPhong = pc.MaPhong
                JOIN dbo.Rap r ON pc.MaRap = r.MaRap
                JOIN dbo.Ghe g ON v.MaGhe = g.MaGhe
                WHERE hd.MaKhachHang = @customerId AND v.TrangThai <> N'Đã hủy'
                GROUP BY 
                    hd.MaHoaDon, hd.ThoiDiemLap, hd.TrangThai, hd.PhuongThucThanhToan, hd.TienGiam, hd.MaCoupon,
                    p.MaPhim, p.TenPhim, p.Poster, p.ThoiLuong, p.DoTuoi,
                    r.MaRap, r.TenRap, pc.TenPhong, pc.CongNgheHoTro, sc.GioBatDau, sc.GioKetThuc
                ORDER BY hd.ThoiDiemLap DESC
            `;

            const result = await pool.request()
                .input('customerId', sql.Int, parseInt(customerId))
                .query(query);

            res.status(200).json({ 
                success: true, 
                total: result.recordset.length,
                data: result.recordset 
            });
        } catch (error) {
            console.error('Lỗi getBookingHistory:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = bookingController;
