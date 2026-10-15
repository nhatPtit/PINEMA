// Quản lý Phim & Thể loại - Kết nối SQL Server RapPhim
const { getPool, sql } = require('../config/db');

// Danh sách poster chất lượng cao fallback gán theo MaPhim
const defaultPosters = [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=60"
];

const movieController = {
    // Lấy danh sách phim từ SQL Server với bộ lọc và tìm kiếm trực tiếp để giảm tải Frontend
    getAllMovies: async (req, res) => {
        try {
            const { status, theLoai, search, q, limit, page } = req.query;
            const searchTerm = (search || q || '').trim();
            const genre = (theLoai || '').trim();
            const pool = await getPool();

            const request = pool.request();
            const whereClauses = [];

            // 1. Lọc theo từ khóa tên phim
            if (searchTerm) {
                request.input('searchTerm', sql.NVarChar(200), `%${searchTerm}%`);
                whereClauses.push(`p.TenPhim LIKE @searchTerm`);
            }

            // 2. Lọc theo thể loại
            if (genre && genre.toLowerCase() !== 'all') {
                request.input('genre', sql.NVarChar(100), `%${genre}%`);
                whereClauses.push(`EXISTS (
                    SELECT 1 FROM dbo.Phim_TheLoai pt2
                    JOIN dbo.TheLoai tl2 ON pt2.MaTheLoai = tl2.MaTheLoai
                    WHERE pt2.MaPhim = p.MaPhim AND tl2.TenTheLoai LIKE @genre
                )`);
            }

            // 3. Lọc theo trạng thái phim
            if (status === 'now_showing' || status === 'dang_chieu') {
                whereClauses.push(`EXISTS (
                    SELECT 1 FROM dbo.SuatChieu sc2
                    WHERE sc2.MaPhim = p.MaPhim AND sc2.GioBatDau >= GETDATE()
                )`);
            } else if (status === 'upcoming' || status === 'sap_chieu') {
                whereClauses.push(`p.ThoiDiemKhoiChieu > CAST(GETDATE() AS DATE)`);
            }

            const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // 4. Hỗ trợ phân trang nếu client yêu cầu
            let paginationSQL = '';
            const limitNum = parseInt(limit, 10);
            const pageNum = parseInt(page, 10) || 1;
            if (!isNaN(limitNum) && limitNum > 0) {
                const offset = Math.max(0, (pageNum - 1) * limitNum);
                request.input('offset', sql.Int, offset);
                request.input('limitNum', sql.Int, limitNum);
                paginationSQL = `OFFSET @offset ROWS FETCH NEXT @limitNum ROWS ONLY`;
            }

            // Đếm tổng số kết quả phù hợp
            const countQuery = `
                SELECT COUNT(DISTINCT p.MaPhim) AS TotalCount
                FROM dbo.Phim p
                ${whereSQL}
            `;
            const countResult = await request.query(countQuery);
            const totalCount = countResult.recordset[0]?.TotalCount || 0;

            const query = `
                SELECT 
                    p.MaPhim, 
                    p.TenPhim, 
                    p.ThoiLuong, 
                    p.ThoiDiemKhoiChieu, 
                    p.ThoiDiemKetThuc, 
                    p.MoTa, 
                    p.DaoDien, 
                    p.DienVien, 
                    p.DoTuoi,
                    p.Poster,
                    p.Trailer,
                    STRING_AGG(tl.TenTheLoai, ', ') AS TheLoaiString
                FROM dbo.Phim p
                LEFT JOIN dbo.Phim_TheLoai pt ON p.MaPhim = pt.MaPhim
                LEFT JOIN dbo.TheLoai tl ON pt.MaTheLoai = tl.MaTheLoai
                ${whereSQL}
                GROUP BY 
                    p.MaPhim, p.TenPhim, p.ThoiLuong, p.ThoiDiemKhoiChieu, 
                    p.ThoiDiemKetThuc, p.MoTa, p.DaoDien, p.DienVien, p.DoTuoi,
                    p.Poster, p.Trailer
                ORDER BY p.MaPhim ASC
                ${paginationSQL}
            `;

            const result = await request.query(query);

            const movies = result.recordset.map((m, index) => ({
                ...m,
                Poster: m.Poster || defaultPosters[m.MaPhim % defaultPosters.length],
                Trailer: m.Trailer || "https://www.youtube.com",
                TheLoai: m.TheLoaiString ? m.TheLoaiString.split(', ') : ['Chính kịch']
            }));

            res.status(200).json({
                success: true,
                message: "Lấy danh sách phim từ CSDL thành công",
                total: totalCount,
                data: movies
            });
        } catch (error) {
            console.error('Lỗi getAllMovies:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy chi tiết một bộ phim theo ID
    getMovieById: async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await getPool();

            const query = `
                SELECT 
                    p.MaPhim, 
                    p.TenPhim, 
                    p.ThoiLuong, 
                    p.ThoiDiemKhoiChieu, 
                    p.ThoiDiemKetThuc, 
                    p.MoTa, 
                    p.DaoDien, 
                    p.DienVien, 
                    p.DoTuoi,
                    p.Poster,
                    p.Trailer,
                    STRING_AGG(tl.TenTheLoai, ', ') AS TheLoaiString
                FROM dbo.Phim p
                LEFT JOIN dbo.Phim_TheLoai pt ON p.MaPhim = pt.MaPhim
                LEFT JOIN dbo.TheLoai tl ON pt.MaTheLoai = tl.MaTheLoai
                WHERE p.MaPhim = @movieId
                GROUP BY 
                    p.MaPhim, p.TenPhim, p.ThoiLuong, p.ThoiDiemKhoiChieu, 
                    p.ThoiDiemKetThuc, p.MoTa, p.DaoDien, p.DienVien, p.DoTuoi,
                    p.Poster, p.Trailer
            `;

            const result = await pool.request()
                .input('movieId', sql.Int, parseInt(id))
                .query(query);

            if (result.recordset.length === 0) {
                return res.status(404).json({ success: false, message: "Không tìm thấy phim" });
            }

            const m = result.recordset[0];
            const movie = {
                ...m,
                Poster: m.Poster || defaultPosters[m.MaPhim % defaultPosters.length],
                Trailer: m.Trailer || "https://www.youtube.com",
                TheLoai: m.TheLoaiString ? m.TheLoaiString.split(', ') : ['Chính kịch']
            };

            res.status(200).json({
                success: true,
                data: movie
            });
        } catch (error) {
            console.error('Lỗi getMovieById:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy danh sách thể loại
    getAllGenres: async (req, res) => {
        try {
            const pool = await getPool();
            const result = await pool.request().query('SELECT * FROM dbo.TheLoai ORDER BY MaTheLoai');
            res.status(200).json({
                success: true,
                data: result.recordset
            });
        } catch (error) {
            console.error('Lỗi getAllGenres:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = movieController;
