const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'donasi.db'));

// Inisialisasi tabel
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT,
        amount INTEGER NOT NULL,
        tipe_donasi TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        waktu_manual TEXT,
        citizen_id TEXT,
        steam_link TEXT,
        added_by TEXT,
        added_by_username TEXT
    )`);
    
    // Migrasi kolom jika belum ada
    db.run(`ALTER TABLE donations ADD COLUMN tipe_donasi TEXT`, (err) => {});
    db.run(`ALTER TABLE donations ADD COLUMN waktu_manual TEXT`, (err) => {});
    db.run(`ALTER TABLE donations ADD COLUMN citizen_id TEXT`, (err) => {});
    db.run(`ALTER TABLE donations ADD COLUMN steam_link TEXT`, (err) => {});
    
    console.log('✅ Database ready');
});

// Helper functions
const dbHelper = {
    // Tambah donasi lengkap
    addDonation: (userId, username, amount, tipeDonasi, waktuManual, citizenId, steamLink, addedBy, addedByUsername) => {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO donations (user_id, username, amount, tipe_donasi, waktu_manual, citizen_id, steam_link, added_by, added_by_username) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, username, amount, tipeDonasi, waktuManual, citizenId, steamLink, addedBy, addedByUsername],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    },
    
    // Get total donasi user
    getUserTotal: (userId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT SUM(amount) as total, COUNT(*) as count 
                 FROM donations WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },
    
    // Get semua user
    getAllUsers: () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT DISTINCT user_id, username FROM donations`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },
    
    // Get top donasi dengan filter waktu
    getTopDonations: (filter = 'all', limit = 10) => {
        return new Promise((resolve, reject) => {
            let whereClause = '';
            
            switch(filter) {
                case 'daily':
                    whereClause = "WHERE date >= date('now', 'start of day')";
                    break;
                case 'weekly':
                    whereClause = "WHERE date >= date('now', '-7 days')";
                    break;
                case 'monthly':
                    whereClause = "WHERE date >= date('now', 'start of month')";
                    break;
                default:
                    whereClause = '';
            }
            
            const query = `
                SELECT user_id, username, SUM(amount) as total, COUNT(*) as transactions,
                       MAX(waktu_manual) as last_donation_manual,
                       MAX(date) as last_donation_auto,
                       GROUP_CONCAT(DISTINCT tipe_donasi) as tipe_donasi_list
                FROM donations 
                ${whereClause}
                GROUP BY user_id 
                ORDER BY total DESC 
                LIMIT ?
            `;
            
            db.all(query, [limit], (err, rows) => {
                if (err) reject(err);
                else {
                    rows.forEach(row => {
                        row.last_donation = row.last_donation_manual || row.last_donation_auto;
                    });
                    resolve(rows);
                }
            });
        });
    },
    
    // Get riwayat user lengkap
    getUserHistory: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, amount, tipe_donasi, date, waktu_manual, citizen_id, steam_link, added_by_username 
                 FROM donations 
                 WHERE user_id = ? 
                 ORDER BY date DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        rows.forEach(row => {
                            row.display_date = row.waktu_manual || row.date;
                        });
                        resolve(rows);
                    }
                }
            );
        });
    },
    
    // Get semua data untuk export
    getAllDonations: (filter = 'all') => {
        return new Promise((resolve, reject) => {
            let whereClause = '';
            
            switch(filter) {
                case 'daily':
                    whereClause = "WHERE date >= date('now', 'start of day')";
                    break;
                case 'weekly':
                    whereClause = "WHERE date >= date('now', '-7 days')";
                    break;
                case 'monthly':
                    whereClause = "WHERE date >= date('now', 'start of month')";
                    break;
                default:
                    whereClause = '';
            }
            
            const query = `
                SELECT * FROM donations
                ${whereClause}
                ORDER BY date DESC
            `;
            
            db.all(query, [], (err, rows) => {
                if (err) reject(err);
                else {
                    rows.forEach(row => {
                        row.display_date = row.waktu_manual || row.date;
                    });
                    resolve(rows);
                }
            });
        });
    },
    
    // Get semua transaksi user
    getUserTransactions: (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, amount, tipe_donasi, date, waktu_manual, added_by_username 
                 FROM donations 
                 WHERE user_id = ? 
                 ORDER BY date DESC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        rows.forEach(row => {
                            row.display_date = row.waktu_manual || row.date;
                        });
                        resolve(rows);
                    }
                }
            );
        });
    },
    
    // Delete transaksi by ID
    deleteTransaction: (id) => {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM donations WHERE id = ?`,
                [id],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },
    
    // Get detail transaksi by ID
    getTransactionById: (id) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT d.*, u.username as user_username 
                 FROM donations d
                 JOIN (SELECT user_id, username FROM donations GROUP BY user_id) u 
                 ON d.user_id = u.user_id
                 WHERE d.id = ?`,
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    },
    
    // Get rekap data
    getRekap: (filter = 'daily') => {
        return new Promise((resolve, reject) => {
            let whereClause = '';
            
            switch(filter) {
                case 'daily':
                    whereClause = "WHERE date >= date('now', 'start of day')";
                    break;
                case 'weekly':
                    whereClause = "WHERE date >= date('now', '-7 days')";
                    break;
                case 'monthly':
                    whereClause = "WHERE date >= date('now', 'start of month')";
                    break;
                case 'all':
                    whereClause = '';
                    break;
                default:
                    whereClause = '';
            }
            
            const summaryQuery = `
                SELECT SUM(amount) as total_pendapatan, COUNT(*) as total_transaksi 
                FROM donations 
                ${whereClause}
            `;
            
            const topQuery = `
                SELECT user_id, username, SUM(amount) as total,
                       GROUP_CONCAT(DISTINCT tipe_donasi) as tipe_list
                FROM donations 
                ${whereClause}
                GROUP BY user_id 
                ORDER BY total DESC 
                LIMIT 3
            `;
            
            db.get(summaryQuery, [], (err, summary) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                db.all(topQuery, [], (err, topUsers) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    resolve({
                        totalPendapatan: summary.total_pendapatan || 0,
                        totalTransaksi: summary.total_transaksi || 0,
                        topUsers: topUsers
                    });
                });
            });
        });
    }
};

module.exports = { db, dbHelper };