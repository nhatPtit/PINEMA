// Frontend JavaScript: Quản lý Trang Chủ, Cụm Rạp, Khuyến Mãi và Phim từ CSDL
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initUserState();
    loadCinemas();
    loadCoupons();
    loadMovies();
    setupFilters();
    setupMovieSearch();
    initModal();
});

let allMovies = [];
let allCinemas = [];
let allCoupons = [];
let currentGenreFilter = 'all';

// ==========================================
// 1. THANH ĐIỀU HƯỚNG & TRẠNG THÁI CUỘN TRANG
// ==========================================
function initNavbar() {
    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    const sections = document.querySelectorAll('header[id], section[id], main[id]');
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navLinks');

    // Toggle menu di động
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            mobileToggle.classList.toggle('open');
        });
    }

    // Cuộn mượt và kích hoạt link
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                e.preventDefault();
                const targetElem = document.querySelector(targetId);
                if (targetElem) {
                    const offset = 80;
                    const bodyRect = document.body.getBoundingClientRect().top;
                    const elementRect = targetElem.getBoundingClientRect().top;
                    const elementPosition = elementRect - bodyRect;
                    const offsetPosition = elementPosition - offset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });

                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');

                    // Đóng mobile menu nếu đang mở
                    if (navMenu && navMenu.classList.contains('active')) {
                        navMenu.classList.remove('active');
                        mobileToggle?.classList.remove('open');
                    }
                }
            }
        });
    });

    // Cập nhật link active khi cuộn trang
    window.addEventListener('scroll', () => {
        let current = '';
        const scrollPosition = window.pageYOffset + 120;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                current = '#' + section.getAttribute('id');
            }
        });

        if (current) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === current) {
                    link.classList.add('active');
                }
            });
        }
    });
}

// Kiểm tra trạng thái đăng nhập của khách hàng
function initUserState() {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;

    try {
        const userJson = localStorage.getItem('user') || localStorage.getItem('currentUser');
        if (userJson) {
            const user = JSON.parse(userJson);
            const displayName = user.hoTen || user.HoTen || user.tenKhachHang || user.email || 'Thành viên';
            const isClerk = user.roleType === 'clerk' || (user.chucVu && !user.chucVu.includes('Quản lý'));
            const staffUrl = isClerk ? '/clerk.html' : '/staff.html';
            const staffText = isClerk ? '🎟️ Bán Vé & Soát Vé' : '🛠️ Quản Trị Rạp';

            navActions.innerHTML = `
                <div class="user-greeting" style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap;">
                    ${isStaff 
                        ? `<a href="${staffUrl}" class="btn btn-sm" style="background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; font-weight: 600; text-decoration: none; padding: 0.4rem 0.8rem; border-radius: 6px;">${staffText}</a>`
                        : `<a href="/my-tickets.html" class="btn btn-outline btn-sm" style="color: var(--gold); border-color: rgba(245, 158, 11, 0.5);">🎟️ Vé Của Tôi</a>`
                    }
                    <span class="user-name">👤 Xin chào, <strong>${escapeHtml(displayName)}</strong></span>
                    <button id="btnLogout" class="btn btn-outline btn-sm">Đăng Xuất</button>
                </div>
            `;

            document.getElementById('btnLogout')?.addEventListener('click', () => {
                localStorage.removeItem('user');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('token');
                showToast('Đã đăng xuất tài khoản thành công!');
                setTimeout(() => window.location.reload(), 1000);
            });
        }
    } catch (e) {
        console.error('Lỗi đọc user state:', e);
    }
}

// ==========================================
// 2. TẢI VÀ HIỂN THỊ CỤM RẠP TỪ DATABASE (Rap)
// ==========================================
async function loadCinemas() {
    const cinemaGrid = document.getElementById('cinemaGrid');
    const countBadge = document.getElementById('cinemaCountBadge');
    if (!cinemaGrid) return;

    try {
        cinemaGrid.innerHTML = '<div class="loading-placeholder">Đang tải danh sách cụm rạp từ CSDL...</div>';
        const response = await fetch('/api/cinemas');
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            allCinemas = result.data;
            if (countBadge) countBadge.textContent = `${allCinemas.length} Cụm Rạp`;
            renderCinemas(allCinemas);
            setupCinemaProvinceFilter();
        } else {
            cinemaGrid.innerHTML = '<div class="loading-placeholder">Không thể tải danh sách rạp từ hệ thống.</div>';
        }
    } catch (error) {
        console.error('Lỗi tải cụm rạp:', error);
        cinemaGrid.innerHTML = '<div class="loading-placeholder error-text">Không thể kết nối máy chủ để tải cụm rạp!</div>';
    }
}

function renderCinemas(cinemas) {
    const cinemaGrid = document.getElementById('cinemaGrid');
    if (!cinemaGrid) return;

    if (cinemas.length === 0) {
        cinemaGrid.innerHTML = '<div class="empty-placeholder">Hiện tại chưa có cụm rạp nào tại khu vực đã chọn. Pinema sẽ sớm có mặt!</div>';
        return;
    }

    cinemaGrid.innerHTML = cinemas.map(cinema => `
        <div class="cinema-card">
            <div class="cinema-card-header">
                <div class="cinema-icon-badge">🏛️</div>
                <div class="cinema-title-wrap">
                    <h3 class="cinema-name">${escapeHtml(cinema.TenRap)}</h3>
                    <span class="cinema-meta-badge">${cinema.SoPhong ? `${cinema.SoPhong} Phòng chiếu` : 'Chuẩn IMAX'}</span>
                </div>
            </div>
            <div class="cinema-card-body">
                <p class="cinema-info-row">
                    <span class="info-icon">📍</span>
                    <span class="info-text">${escapeHtml(cinema.DiaChi || 'Hà Nội')}</span>
                </p>
                <p class="cinema-info-row">
                    <span class="info-icon">📞</span>
                    <span class="info-text">Hotline: <strong>${escapeHtml(cinema.SDT || cinema.SoDienThoai || '1900 6868')}</strong></span>
                </p>
                <div class="cinema-features-tag">
                    <span class="tag-pill">✨ IMAX Laser</span>
                    <span class="tag-pill">🔊 Dolby Atmos</span>
                    <span class="tag-pill">🍿 Sweetbox</span>
                </div>
            </div>
            <div class="cinema-card-footer">
                <button class="btn btn-primary btn-sm btn-view-rooms" data-id="${cinema.MaRap}" data-name="${escapeHtml(cinema.TenRap)}">
                    Xem Phòng Chiếu
                </button>
                <a href="#movies" class="btn btn-outline btn-sm">Xem Lịch Chiếu</a>
            </div>
        </div>
    `).join('');

    // Đăng ký sự kiện mở modal phòng chiếu
    document.querySelectorAll('.btn-view-rooms').forEach(btn => {
        btn.addEventListener('click', () => {
            const cinemaId = btn.getAttribute('data-id');
            const cinemaName = btn.getAttribute('data-name');
            openCinemaModal(cinemaId, cinemaName);
        });
    });
}

function setupCinemaProvinceFilter() {
    const selectEl = document.getElementById('cinemaProvinceSelect');
    const countBadge = document.getElementById('cinemaCountBadge');
    if (!selectEl) return;

    // Lấy danh sách các tỉnh/thành từ dữ liệu rạp
    const provinceMap = new Map();
    allCinemas.forEach(c => {
        let province = c.Tinh;
        if (!province && c.DiaChi) {
            const parts = c.DiaChi.split(',');
            province = parts[parts.length - 1].trim();
        }
        if (!province) province = 'Hà Nội';

        provinceMap.set(province, (provinceMap.get(province) || 0) + 1);
    });

    const sortedProvinces = Array.from(provinceMap.keys()).sort();

    selectEl.innerHTML = `
        <option value="all">📍 Tất cả tỉnh / thành (${allCinemas.length} cụm rạp)</option>
        ${sortedProvinces.map(p => {
            const count = provinceMap.get(p);
            return `<option value="${escapeHtml(p)}">📍 ${escapeHtml(p)} (${count} cụm rạp)</option>`;
        }).join('')}
    `;

    selectEl.addEventListener('change', (e) => {
        const selected = e.target.value;
        let filtered = allCinemas;
        if (selected !== 'all') {
            filtered = allCinemas.filter(c => {
                const prov = (c.Tinh || '').toLowerCase();
                const addr = (c.DiaChi || '').toLowerCase();
                const sel = selected.toLowerCase();
                return prov === sel || addr.includes(sel);
            });
        }
        if (countBadge) {
            countBadge.textContent = `${filtered.length} Cụm Rạp`;
        }
        renderCinemas(filtered);
    });
}

// ==========================================
// 3. TẢI VÀ HIỂN THỊ KHUYẾN MÃI (Coupon)
// ==========================================
async function loadCoupons() {
    const couponGrid = document.getElementById('couponGrid');
    const countBadge = document.getElementById('couponCountBadge');
    if (!couponGrid) return;

    try {
        couponGrid.innerHTML = '<div class="loading-placeholder">Đang tải danh sách khuyến mãi khả dụng...</div>';
        const response = await fetch('/api/bookings/coupons');
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            allCoupons = result.data;
            if (countBadge) countBadge.textContent = `${allCoupons.length} Mã Khả Dụng`;
            renderCoupons(allCoupons.slice(0, 8)); // Hiển thị 8 voucher tiêu biểu
        } else {
            couponGrid.innerHTML = '<div class="loading-placeholder">Hiện chưa có chương trình khuyến mãi nào.</div>';
        }
    } catch (error) {
        console.error('Lỗi tải khuyến mãi:', error);
        couponGrid.innerHTML = '<div class="loading-placeholder error-text">Không thể kết nối máy chủ để tải voucher!</div>';
    }
}

function renderCoupons(coupons) {
    const couponGrid = document.getElementById('couponGrid');
    if (!couponGrid) return;

    if (coupons.length === 0) {
        couponGrid.innerHTML = '<div class="empty-placeholder">Hiện tại chưa có mã giảm giá nào khả dụng.</div>';
        return;
    }

    couponGrid.innerHTML = coupons.map(c => {
        const isPercent = c.LoaiGiamGia === 'Phần trăm';
        const discountText = isPercent ? `GIẢM ${c.GiaTriGiam}%` : `GIẢM ${Number(c.GiaTriGiam).toLocaleString('vi-VN')}Đ`;
        const minOrder = c.GiaTriHoaDonToiThieu ? `Đơn tối thiểu: ${Number(c.GiaTriHoaDonToiThieu).toLocaleString('vi-VN')}đ` : 'Không giới hạn';
        const maxDiscount = (isPercent && c.GiamToiDa) ? `Tối đa ${Number(c.GiamToiDa).toLocaleString('vi-VN')}đ` : '';
        const expiryDate = c.ThoiGianKetThuc ? new Date(c.ThoiGianKetThuc).toLocaleDateString('vi-VN') : 'Vô thời hạn';
        const remaining = c.SoLuongConLai !== undefined ? c.SoLuongConLai : (c.SoLuong - c.SoLuongDaDung);

        return `
            <div class="coupon-card">
                <div class="coupon-left">
                    <span class="coupon-tag">${isPercent ? '🔥 PHẦN TRĂM' : '💰 TIỀN MẶT'}</span>
                    <h3 class="coupon-discount">${discountText}</h3>
                    <p class="coupon-name" title="${escapeHtml(c.TenChuongTrinh)}">${escapeHtml(c.TenChuongTrinh)}</p>
                    <div class="coupon-details">
                        <span>${minOrder}</span>
                        ${maxDiscount ? `<span> • ${maxDiscount}</span>` : ''}
                    </div>
                    <div class="coupon-expiry">
                        <span>📅 HSD: ${expiryDate}</span>
                        ${remaining ? `<span class="coupon-left-count"> • Còn ${remaining} lượt</span>` : ''}
                    </div>
                </div>
                <div class="coupon-divider"></div>
                <div class="coupon-right">
                    <div class="coupon-code-badge">${escapeHtml(c.MaCoupon)}</div>
                    <button class="btn btn-sm btn-gold btn-copy-coupon" data-code="${escapeHtml(c.MaCoupon)}">
                        Sao Chép
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Đăng ký sự kiện copy mã coupon
    document.querySelectorAll('.btn-copy-coupon').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-code');
            if (code) {
                navigator.clipboard.writeText(code).then(() => {
                    showToast(`Đã sao chép mã voucher: ${code}! Dán vào bước thanh toán để nhận giảm giá.`);
                }).catch(() => {
                    showToast(`Mã giảm giá: ${code}`);
                });
            }
        });
    });
}

// ==========================================
// 4. TẢI VÀ HIỂN THỊ PHIM TỪ DATABASE (Phim)
// ==========================================
let searchDebounceTimeout = null;

async function loadMovies() {
    const movieGrid = document.getElementById('movieGrid');
    const movieCountBadge = document.getElementById('movieCountBadge');
    if (!movieGrid) return;

    const searchInput = document.getElementById('movieSearch');
    const searchQuery = searchInput ? searchInput.value.trim() : '';

    try {
        movieGrid.innerHTML = '<div class="loading-placeholder">Đang tải danh sách phim từ CSDL...</div>';

        const params = new URLSearchParams();
        if (currentGenreFilter && currentGenreFilter !== 'all') {
            params.append('theLoai', currentGenreFilter);
        }
        if (searchQuery) {
            params.append('search', searchQuery);
        }

        const url = `/api/movies${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            allMovies = result.data;
            if (movieCountBadge) {
                movieCountBadge.textContent = `${result.total !== undefined ? result.total : allMovies.length} Phim`;
            }
            renderMovies(allMovies);
        } else {
            movieGrid.innerHTML = '<div class="loading-placeholder">Không thể tải danh sách phim từ hệ thống.</div>';
        }
    } catch (error) {
        console.error('Lỗi gọi API phim:', error);
        movieGrid.innerHTML = '<div class="loading-placeholder error-text">Lỗi kết nối máy chủ khi nạp phim!</div>';
    }
}

function renderMovies(movies) {
    const movieGrid = document.getElementById('movieGrid');
    const movieCountBadge = document.getElementById('movieCountBadge');
    if (!movieGrid) return;

    if (movieCountBadge) {
        movieCountBadge.textContent = `${movies.length} Phim`;
    }

    if (movies.length === 0) {
        movieGrid.innerHTML = '<div class="empty-placeholder" style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">Không tìm thấy phim phù hợp với từ khóa hoặc thể loại đã chọn.</div>';
        return;
    }

    movieGrid.innerHTML = movies.map(movie => {
        const genres = Array.isArray(movie.TheLoai) ? movie.TheLoai : ['Điện ảnh'];
        const posterUrl = movie.Poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500';

        return `
            <div class="movie-card">
                <div class="movie-poster-wrap">
                    <span class="movie-age-badge">T${movie.DoTuoi || '13'}</span>
                    <img src="${escapeHtml(posterUrl)}" alt="${escapeHtml(movie.TenPhim)}" class="movie-poster" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'">
                </div>
                <div class="movie-info">
                    <h3 class="movie-name" title="${escapeHtml(movie.TenPhim)}">${escapeHtml(movie.TenPhim)}</h3>
                    <div class="movie-meta-small">
                        <span>⏱️ ${movie.ThoiLuong} phút</span>
                        <span>⭐ 4.9/5</span>
                    </div>
                    <div class="movie-genres">
                        ${genres.slice(0, 3).map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                    </div>
                    <div class="card-actions">
                        <a href="/movie-detail.html?id=${movie.MaPhim}" class="btn btn-primary">Đặt Vé Ngay</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function applyMovieFilters() {
    loadMovies();
}

function setupFilters() {
    const filterButtons = document.querySelectorAll('#genreFilters .filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            currentGenreFilter = e.target.getAttribute('data-filter') || 'all';
            loadMovies();
        });
    });
}

function setupMovieSearch() {
    const searchInput = document.getElementById('movieSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            loadMovies();
        }, 300);
    });
}

// ==========================================
// 5. MODAL XEM PHÒNG CHIẾU CỦA RẠP
// ==========================================
function initModal() {
    const modal = document.getElementById('cinemaModal');
    const closeBtn = document.getElementById('modalClose');
    const overlay = document.getElementById('modalOverlay');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.getElementById('cinemaModal');
    if (modal) modal.classList.remove('active');
}

let currentSelectedCinema = null;

async function openCinemaModal(cinemaId, cinemaName) {
    const modal = document.getElementById('cinemaModal');
    const title = document.getElementById('modalCinemaTitle');
    const breadcrumb = document.getElementById('modalBreadcrumb');
    const body = document.getElementById('modalCinemaBody');

    if (!modal || !title || !body) return;

    currentSelectedCinema = { id: cinemaId, name: cinemaName };
    title.innerHTML = `🏛️ ${escapeHtml(cinemaName)}`;
    
    if (breadcrumb) {
        breadcrumb.style.display = 'flex';
        breadcrumb.innerHTML = `
            <span class="step-item active">1. Chọn Phòng Chiếu</span>
            <span class="step-separator">›</span>
            <span class="step-item" style="color: var(--text-muted);">2. Chọn Suất Chiếu</span>
            <span class="step-separator">›</span>
            <span class="step-item" style="color: var(--text-muted);">3. Đặt Ghế</span>
        `;
    }

    body.innerHTML = '<div class="loading-placeholder">Đang tải danh sách phòng chiếu...</div>';
    modal.classList.add('active');

    try {
        const response = await fetch(`/api/cinemas/${cinemaId}/rooms`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            body.innerHTML = `
                <div style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.95rem;">
                    Vui lòng chọn một phòng chiếu bên dưới để xem các suất chiếu sắp tới:
                </div>
                <div class="rooms-list">
                    ${result.data.map(room => `
                        <div class="room-item-card" onclick="openRoomShowtimes(${room.MaPhong}, '${escapeHtml(room.TenPhong)}', '${escapeHtml(room.CongNgheHoTro || '2D')}', ${room.PhuPhiCongNghe || 0})">
                            <div class="room-main">
                                <h4 class="room-title">🎬 ${escapeHtml(room.TenPhong)}</h4>
                                <div class="room-badges">
                                    <span class="badge-tech">${escapeHtml(room.CongNgheHoTro || '2D')}</span>
                                    <span class="badge-seats">💺 ${room.SoLuongGhe} ghế</span>
                                    ${room.PhuPhiCongNghe > 0 ? `<span class="badge-fee">+${Number(room.PhuPhiCongNghe).toLocaleString('vi-VN')}đ phụ thu</span>` : ''}
                                </div>
                            </div>
                            <div class="room-status" style="display: flex; align-items: center; gap: 0.8rem;">
                                <span class="status-indicator ${room.TrangThai === 'Hoạt động' ? 'status-active' : ''}">
                                    ● ${escapeHtml(room.TrangThai || 'Hoạt động')}
                                </span>
                                <button class="btn btn-sm btn-primary btn-select-room">
                                    Xem Suất Chiếu ›
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            body.innerHTML = '<div class="empty-placeholder">Hiện rạp chưa có phòng chiếu hoạt động.</div>';
        }
    } catch (error) {
        console.error('Lỗi tải phòng chiếu:', error);
        body.innerHTML = '<div class="loading-placeholder error-text">Không thể kết nối máy chủ để tải thông tin phòng chiếu!</div>';
    }
}

// Tải và hiển thị danh sách Suất chiếu theo Phòng chiếu
async function openRoomShowtimes(roomId, roomName, roomTech, surcharge) {
    const title = document.getElementById('modalCinemaTitle');
    const breadcrumb = document.getElementById('modalBreadcrumb');
    const body = document.getElementById('modalCinemaBody');

    if (!title || !body) return;

    title.innerHTML = `🎬 ${escapeHtml(roomName)} - ${escapeHtml(currentSelectedCinema?.name || 'Rạp Pinema')}`;

    if (breadcrumb) {
        breadcrumb.innerHTML = `
            <span class="step-item" onclick="openCinemaModal(${currentSelectedCinema?.id}, '${escapeHtml(currentSelectedCinema?.name)}')">‹ Trở lại: Chọn Phòng Chiếu</span>
            <span class="step-separator">›</span>
            <span class="step-item active">2. Chọn Suất Chiếu (${escapeHtml(roomName)})</span>
            <span class="step-separator">›</span>
            <span class="step-item" style="color: var(--text-muted);">3. Đặt Ghế</span>
        `;
    }

    body.innerHTML = '<div class="loading-placeholder">Đang tải các suất chiếu của phòng...</div>';

    try {
        const response = await fetch(`/api/showtimes/room/${roomId}`);
        const result = await response.json();

        const now = new Date();
        const upcomingShowtimes = (result.success && Array.isArray(result.data))
            ? result.data.filter(st => {
                const d = parseDbDate(st.ThoiGianBatDau);
                return d && d > now;
            })
            : [];

        if (upcomingShowtimes.length > 0) {
            body.innerHTML = `
                <div style="margin-bottom: 1.2rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted); font-size: 0.95rem;">
                        Tìm thấy <strong>${upcomingShowtimes.length}</strong> suất chiếu sắp tới. Chọn một suất để vào giao diện đặt ghế:
                    </span>
                    <button class="btn btn-outline btn-sm" onclick="openCinemaModal(${currentSelectedCinema?.id}, '${escapeHtml(currentSelectedCinema?.name)}')">
                        ‹ Đổi phòng chiếu
                    </button>
                </div>
                <div class="showtimes-modal-list">
                    ${upcomingShowtimes.map(st => {
                        const start = parseDbDate(st.ThoiGianBatDau) || new Date();
                        const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
                        const dateStr = `${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getFullYear()}`;
                        const poster = st.Poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500';
                        const totalBasePrice = Number(st.GiaVeCoBan) + Number(st.PhuPhiCongNghe || 0);

                        return `
                            <div class="showtime-modal-item">
                                <img src="${escapeHtml(poster)}" alt="${escapeHtml(st.TenPhim)}" class="showtime-movie-poster" onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500'">
                                <div class="showtime-modal-info">
                                    <h4 class="showtime-modal-title">${escapeHtml(st.TenPhim)}</h4>
                                    <div class="showtime-modal-meta">
                                        <span>⏱️ ${st.ThoiLuong || 100} phút</span>
                                        <span>🔞 T${st.DoTuoi || 13}</span>
                                        <span>📅 Ngày ${dateStr}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                                        <div class="showtime-time-tag">
                                            ⏰ ${timeStr}
                                        </div>
                                        <div class="showtime-modal-price">
                                            ${totalBasePrice.toLocaleString('vi-VN')} VNĐ
                                        </div>
                                    </div>
                                </div>
                                <div class="showtime-action-wrap">
                                    <a href="/booking.html?showtimeId=${st.MaSuat}" class="btn btn-primary">
                                        Chọn Ghế & Đặt Vé ›
                                    </a>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            body.innerHTML = `
                <div class="empty-placeholder" style="padding: 2.5rem 1rem;">
                    <p style="margin-bottom: 1.2rem;">Hiện phòng này chưa có lịch chiếu sắp tới.</p>
                    <button class="btn btn-primary btn-sm" onclick="openCinemaModal(${currentSelectedCinema?.id}, '${escapeHtml(currentSelectedCinema?.name)}')">
                        ‹ Quay lại chọn phòng chiếu khác
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Lỗi tải suất chiếu:', error);
        body.innerHTML = '<div class="loading-placeholder error-text">Không thể kết nối máy chủ để tải danh sách suất chiếu!</div>';
    }
}

// ==========================================
// 6. TIỆN ÍCH THÔNG BÁO TOAST & ESCAPE HTML
// ==========================================
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parseDbDate(val) {
    if (!val) return null;
    const str = String(val).replace(/Z$/i, '').replace(' ', 'T');
    const d = new Date(str);
    return isNaN(d) ? new Date(val) : d;
}
