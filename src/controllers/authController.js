// Quản lý xác thực: Khách hàng và Nhân viên kết nối CSDL RapPhim
const crypto = require('crypto');
const { getPool, sql } = require('../config/db');

// Hàm băm mật khẩu chuẩn SHA-256 viết hoa (tương thích CSDL RapPhim)
function hashPassword(password) {
    if (!password) return '';
    return crypto.createHash('sha256').update(password).digest('hex').toUpperCase();
}

// So sánh mật khẩu: chấp nhận cả mã hash SHA-256 lẫn chuỗi plain text
function verifyPassword(storedPassword, inputPassword) {
    if (!storedPassword || !inputPassword) return false;
    const cleanInput = inputPassword.trim();
    if (storedPassword === cleanInput) return true;
    if (storedPassword === hashPassword(cleanInput)) return true;
    return false;
}

const authController = {
    // Đăng ký tài khoản Khách hàng
    registerCustomer: async (req, res) => {
        try {
            const { hoTen, email, sdt, matKhau, ngaySinh } = req.body;

            if (!hoTen || !sdt || !matKhau) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập đầy đủ họ tên, số điện thoại và mật khẩu!"
                });
            }

            const pool = await getPool();

            // Kiểm tra trùng lặp Số điện thoại hoặc Email
            const checkQuery = `
                SELECT MaKhachHang FROM dbo.KhachHang 
                WHERE SoDienThoai = @sdt 
                   OR (@email IS NOT NULL AND Email = @email AND Email <> '')
            `;
            const checkResult = await pool.request()
                .input('sdt', sql.VarChar(15), sdt.trim())
                .input('email', sql.VarChar(100), email ? email.trim() : null)
                .query(checkQuery);

            if (checkResult.recordset.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Số điện thoại hoặc Email này đã được đăng ký tài khoản!"
                });
            }

            // Lưu mật khẩu dạng thô (plain text) trực tiếp vào CSDL
            const passwordToSave = matKhau.trim();
            const birthDate = ngaySinh ? ngaySinh : '2000-01-01';

            const insertQuery = `
                INSERT INTO dbo.KhachHang (HoTen, SoDienThoai, Email, NgaySinh, MatKhau)
                OUTPUT INSERTED.MaKhachHang, INSERTED.HoTen, INSERTED.SoDienThoai, INSERTED.Email
                VALUES (@hoTen, @sdt, @email, @ngaySinh, @matKhau)
            `;

            const insertResult = await pool.request()
                .input('hoTen', sql.NVarChar(100), hoTen.trim())
                .input('sdt', sql.VarChar(15), sdt.trim())
                .input('email', sql.VarChar(100), email ? email.trim() : null)
                .input('ngaySinh', sql.Date, birthDate)
                .input('matKhau', sql.VarChar(64), passwordToSave)
                .query(insertQuery);

            const newUser = insertResult.recordset[0];

            res.status(201).json({
                success: true,
                message: "Đăng ký tài khoản khách hàng thành công!",
                data: {
                    maKhachHang: newUser.MaKhachHang,
                    hoTen: newUser.HoTen,
                    sdt: newUser.SoDienThoai,
                    email: newUser.Email,
                    role: 'customer'
                }
            });
        } catch (error) {
            console.error('Lỗi registerCustomer:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Đăng nhập tự động nhận diện Khách hàng hoặc Nhân viên
    loginCustomer: async (req, res) => {
        try {
            const { account, email, sdt, matKhau } = req.body;
            const loginIdentifier = account || email || sdt;

            if (!loginIdentifier || !matKhau) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập tài khoản (Email/SĐT) và mật khẩu!"
                });
            }

            const pool = await getPool();
            const cleanIdentifier = loginIdentifier.trim();

            // 1. Kiểm tra trong bảng Nhân viên trước
            const staffQuery = `
                SELECT MaNhanVien, HoTen, SoDienThoai, Email, ChucVu, TrangThai, MatKhau
                FROM dbo.NhanVien
                WHERE (Email = @identifier OR SoDienThoai = @identifier)
            `;
            const staffResult = await pool.request()
                .input('identifier', sql.VarChar(100), cleanIdentifier)
                .query(staffQuery);

            if (staffResult.recordset.length > 0) {
                const staff = staffResult.recordset[0];

                if (!verifyPassword(staff.MatKhau, matKhau)) {
                    return res.status(401).json({
                        success: false,
                        message: "Mật khẩu không chính xác!"
                    });
                }

                if (staff.TrangThai === 'Nghỉ việc') {
                    return res.status(403).json({
                        success: false,
                        message: "Tài khoản nhân viên này đã nghỉ việc, không thể đăng nhập!"
                    });
                }

                const isManager = staff.ChucVu && staff.ChucVu.includes('Quản lý');
                const roleType = isManager ? 'manager' : 'clerk';

                return res.status(200).json({
                    success: true,
                    message: "Đăng nhập nhân viên thành công!",
                    data: {
                        maNhanVien: staff.MaNhanVien,
                        hoTen: staff.HoTen,
                        sdt: staff.SoDienThoai,
                        email: staff.Email,
                        chucVu: staff.ChucVu,
                        role: 'staff',
                        roleType: roleType
                    }
                });
            }

            // 2. Nếu không phải nhân viên, kiểm tra bảng Khách hàng
            const customerQuery = `
                SELECT MaKhachHang, HoTen, SoDienThoai, Email, NgaySinh, MatKhau
                FROM dbo.KhachHang
                WHERE (Email = @identifier OR SoDienThoai = @identifier)
            `;

            const customerResult = await pool.request()
                .input('identifier', sql.VarChar(100), cleanIdentifier)
                .query(customerQuery);

            if (customerResult.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Tài khoản không tồn tại trong hệ thống!"
                });
            }

            const user = customerResult.recordset[0];

            if (!verifyPassword(user.MatKhau, matKhau)) {
                return res.status(401).json({
                    success: false,
                    message: "Mật khẩu không chính xác!"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Đăng nhập thành công!",
                data: {
                    maKhachHang: user.MaKhachHang,
                    hoTen: user.HoTen,
                    sdt: user.SoDienThoai,
                    email: user.Email,
                    role: 'customer'
                }
            });
        } catch (error) {
            console.error('Lỗi loginCustomer:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Đăng nhập Nhân viên (Quản trị/Bán vé)
    loginStaff: async (req, res) => {
        try {
            const { account, email, sdt, matKhau } = req.body;
            const loginIdentifier = account || email || sdt;

            if (!loginIdentifier || !matKhau) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập tài khoản và mật khẩu nhân viên!"
                });
            }

            const pool = await getPool();

            const query = `
                SELECT MaNhanVien, HoTen, SoDienThoai, Email, ChucVu, TrangThai, MatKhau
                FROM dbo.NhanVien
                WHERE (Email = @identifier OR SoDienThoai = @identifier)
            `;

            const result = await pool.request()
                .input('identifier', sql.VarChar(100), loginIdentifier.trim())
                .query(query);

            if (result.recordset.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Tài khoản nhân viên không tồn tại!"
                });
            }

            const staff = result.recordset[0];

            if (!verifyPassword(staff.MatKhau, matKhau)) {
                return res.status(401).json({
                    success: false,
                    message: "Mật khẩu nhân viên không chính xác!"
                });
            }

            if (staff.TrangThai === 'Nghỉ việc') {
                return res.status(403).json({
                    success: false,
                    message: "Tài khoản nhân viên này đã nghỉ việc, không thể đăng nhập!"
                });
            }

            const isManager = staff.ChucVu && staff.ChucVu.includes('Quản lý');
            const roleType = isManager ? 'manager' : 'clerk';

            res.status(200).json({
                success: true,
                message: "Đăng nhập nhân viên thành công!",
                data: {
                    maNhanVien: staff.MaNhanVien,
                    hoTen: staff.HoTen,
                    sdt: staff.SoDienThoai,
                    email: staff.Email,
                    chucVu: staff.ChucVu,
                    role: 'staff',
                    roleType: roleType
                }
            });
        } catch (error) {
            console.error('Lỗi loginStaff:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = authController;
