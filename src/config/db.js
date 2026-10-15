const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'RapPhim',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    options: {
        encrypt: false, // Sử dụng false cho local dev SQL Server
        trustServerCertificate: true, // Chấp nhận self-signed cert khi chạy local
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise = null;

async function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then(pool => {
                console.log('✅ Đã kết nối thành công đến SQL Server database:', config.database);
                return pool;
            })
            .catch(err => {
                console.error('❌ Lỗi kết nối SQL Server:', err.message);
                console.warn('⚠️ Server vẫn tiếp tục hoạt động. Vui lòng kiểm tra cấu hình trong file .env');
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

module.exports = {
    sql,
    getPool
};
