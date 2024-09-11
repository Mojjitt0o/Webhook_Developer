const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const port = 3000;


// Middleware
app.use(cors()); // Mengizinkan permintaan dari sumber berbeda
app.use(bodyParser.json()); // Mengurai tubuh permintaan sebagai JSON
app.use(express.static('public')); // Menyajikan file statis dari direktori 'public'

// Membuat server HTTP dan menghubungkannya dengan Socket.IO
const server = http.createServer(app);
const io = socketIo(server);

// Koneksi MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'webhook'
});

db.connect((err) => {
    if (err) {
        console.error('Error koneksi:', err);
        return;
    }
    console.log('Terhubung ke MySQL');
});

// Membuat tabel karyawan jika belum ada
const createTableQuery = `
CREATE TABLE IF NOT EXISTS karyawan (
    pin VARCHAR(255) PRIMARY KEY,
    cloud_id VARCHAR(255) NOT NULL,
    nama VARCHAR(255) NOT NULL,
    jabatan VARCHAR(255),
    password VARCHAR(255) -- Menambahkan kolom password
);
`;

db.query(createTableQuery, (err) => {
    if (err) {
        console.error('Error membuat tabel:', err);
    } else {
        console.log('Tabel `karyawan` sudah siap');
    }
});

// Token bot Telegram dan ID chat
const TELEGRAM_BOT_TOKEN = '7390265210:AAFAFKwsl8OVe-VvCafxVBGhfaQCiQNWsFg'; // Ganti dengan token bot Anda
const CHAT_ID = '1421950780'; // Ganti dengan chat ID atau grup ID Anda

// Token bot Telegram dan ID chat
const TELEGRAM_BOT_TOKEN1 = '7269989921:AAEDVrc3hBFDCuqblhV8Pga5a3NaFvPR5iw'; // Ganti dengan token bot Anda
const CHAT_ID1 = '1421950780'; // Ganti dengan chat ID atau grup ID Anda

// URL webhook Telegram
const TELEGRAM_WEBHOOK_URL = 'https://25ba-104-28-247-133.ngrok-free.app/'; // Ganti dengan URL webhook Anda


// Fungsi untuk mengirim pesan ke Telegram
async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN1}/sendMessage`;
    console.log('Mencoba mengirim pesan ke Telegram...');

    try {
        const response = await axios.post(url, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('Respon Telegram:', response.data);
        if (response.data.ok) {
            console.log('Pesan berhasil dikirim');
        } else {
            console.error('Gagal mengirim pesan:', response.data.description);
        }
    } catch (error) {
        console.error('Error mengirim pesan ke Telegram:', {
            message: error.message,
            response: error.response ? error.response.data : 'Tidak ada data respon'
        });
    }
}

// Fungsi untuk mengirim notifikasi ke endpoint
async function sendEndpointNotification(endpoint, data) {
    try {
        await axios.post(endpoint, data);
        console.log('Notifikasi endpoint berhasil dikirim ke:', endpoint);
    } catch (error) {
        console.error('Error mengirim notifikasi endpoint:', error.message);
    }
}

// Helper untuk memanggil API eksternal
const authorization = 'Bearer SZS7NOV9IBE4TJTI';
const apiBaseUrl = 'https://developer.fingerspot.io/api/';

async function callApi(endpoint, data, res, notificationEndpoint) {
    try {
        const response = await axios.post(`${apiBaseUrl}${endpoint}`, data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization
            }
        });
        res.json(response.data);

        // Kirim notifikasi ke Telegram dan endpoint jika ada
        const message = `API call to ${endpoint} with data: ${JSON.stringify(data)}`;
        await sendTelegramMessage(message);

        if (notificationEndpoint) {
            await sendEndpointNotification(notificationEndpoint, { endpoint, data });
        }
    } catch (error) {
        console.error(`Error calling ${endpoint}:`, error);
        res.status(500).json({ error: 'API call failed' });
    }
}

// Routes untuk setiap fungsi
app.post('/api/delete_userinfo', (req, res) => {
    const data = req.body;  // Contoh input JSON: {"trans_id":"1", "cloud_id":"C2630450C3233B26", "pin":"8"}
    const notificationEndpoint = req.body.notification_endpoint; // Ambil endpoint notifikasi dari body request
    callApi('delete_userinfo', data, res, notificationEndpoint);
});

app.post('/api/get_allpin', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('get_allpin', data, res, notificationEndpoint);
});

app.post('/api/get_attlog', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('get_attlog', data, res, notificationEndpoint);
});

app.post('/api/get_registeronline', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('get_registeronline', data, res, notificationEndpoint);
});

app.post('/api/get_userinfo', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('get_userinfo', data, res, notificationEndpoint);
});

app.post('/api/restart_device', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('restart_device', data, res, notificationEndpoint);
});

app.post('/api/set_time', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('set_time', data, res, notificationEndpoint);
});

app.post('/api/set_userinfo', (req, res) => {
    const data = req.body;
    const notificationEndpoint = req.body.notification_endpoint;
    callApi('set_userinfo', data, res, notificationEndpoint);
});

// Rute /store dengan notifikasi Telegram dan notifikasi endpoint opsional
app.post('/store', (req, res) => {
    console.log('Menerima permintaan di /store dengan body:', req.body);
    const original_data = JSON.stringify(req.body);
    const { type, cloud_id, data, notification_endpoint } = req.body;
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Ekstrak informasi waktu dari original_data
    let scanTime = data && data.scan ? data.scan : 'Unknown';
    try {
        const parsedData = JSON.parse(original_data);
        if (parsedData && parsedData.scan) {
            scanTime = parsedData.scan;
        }
    } catch (err) {
        console.error('Error parsing original_data:', err);
    }

    // Potong original_data jika panjangnya melebihi batas
    const maxDataLength = 3000; // Sesuaikan dengan batas panjang yang sesuai
    const truncatedOriginalData = original_data.length > maxDataLength
        ? original_data.substring(0, maxDataLength) + '...'
        : original_data;

    // Perbarui query SQL untuk memasukkan scanTime
    const sql = "INSERT INTO t_log (cloud_id, type, created_at, original_data, scanTime) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [cloud_id, type, created_at, truncatedOriginalData, scanTime], (error, results) => {
        if (error) {
            console.error('Error menyimpan log:', error);
            return res.status(500).json({ error: error.message });
        }
        console.log('Entri log berhasil dimasukkan');

        let pin = data && data.pin ? data.pin : 'Unknown';
        let name = 'Unknown';
        let jabatan = 'Unknown';
        let password = 'Unknown';

        if (data && data.pin) {
            // Jika PIN ada, query database untuk mengambil detail karyawan
            const pinVerificationSql = "SELECT nama, jabatan, password FROM karyawan WHERE pin = ?";
            db.query(pinVerificationSql, [pin], (pinError, pinResults) => {
                if (pinError) {
                    console.error('Error menanyakan data pin:', pinError);
                    return res.status(500).json({ error: 'Error menanyakan data pin' });
                }

                if (pinResults.length > 0) {
                    name = pinResults[0].nama;
                    jabatan = pinResults[0].jabatan;
                    password = pinResults[0].password;
                }

                sendNotificationAndRespond();
            });
        } else {
            // Jika tidak ada PIN, tetap kirim notifikasi
            sendNotificationAndRespond();
         }

        function sendNotificationAndRespond() {
            // Membatasi panjang pesan untuk Telegram agar tidak melebihi batas
            const message = `
<b>Entri Log Baru</b>
<b>PIN:</b> ${pin}
<b>Nama:</b> ${name}
<b>Jabatan:</b> ${jabatan}
<b>Password:</b> ${password}
<b>Cloud ID:</b> ${cloud_id}
<b>Waktu Scan:</b> ${scanTime}
<b>Data Asli:</b> ${truncatedOriginalData}
`;

            sendTelegramMessage(message);

            if (notification_endpoint) {
                sendEndpointNotification(notification_endpoint, { cloud_id, type, created_at, original_data, scanTime });
            }

            res.json({ status: 'success', message: 'Log berhasil disimpan dan notifikasi dikirim' });
        }
    });
});

// Webhook handler untuk Telegram
app.post('/webhook', (req, res) => {
    const update = req.body;
    console.log('Webhook diterima:', update);

    if (update.message) {
        const chatId = update.message.chat.id;
        const messageText = update.message.text;

        // Kirim pesan balasan ke pengguna
        axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN1}/sendMessage`, {
            chat_id: chatId,
            text: `Anda mengatakan: ${messageText}`
        }).then(() => {
            console.log('Pesan balasan dikirim');
        }).catch((error) => {
            console.error('Error mengirim pesan balasan:', error);
        });

        // Kirim pesan ke semua klien melalui Socket.IO
        io.emit('telegramMessage', messageText);
    }

    res.sendStatus(200);
});

// Setup webhook untuk bot Telegram
async function setupTelegramWebhook() {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN1}/setWebhook?url=${TELEGRAM_WEBHOOK_URL}webhook`;

    try {
        const response = await axios.get(url);
        if (response.data.ok) {
            console.log('Webhook Telegram berhasil diatur');
        } else {
            console.error('Gagal mengatur webhook Telegram:', response.data.description);
        }
    } catch (error) {
        console.error('Error mengatur webhook Telegram:', error.message);
    }
}

// Setup webhook saat server dimulai
setupTelegramWebhook().catch(console.error);

// Upload file Excel
const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }

    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Menyimpan data ke database
    const insertQuery = "INSERT INTO karyawan (pin, cloud_id, nama, jabatan, password) VALUES (?, ?, ?, ?, ?)";

    data.forEach((row) => {
        db.query(insertQuery, [row.pin, row.cloud_id, row.nama, row.jabatan, row.password], (err) => {
            if (err) {
                console.error('Error menyimpan data:', err);
            }
        });
    });

    fs.unlinkSync(filePath); // Menghapus file setelah diupload dan diproses
    res.json({ status: 'success', message: 'File berhasil diupload dan diproses' });
});

// Socket.io untuk pembaruan langsung
io.on('connection', (socket) => {
    console.log('Pengguna terhubung');

    // Kirim pesan ke pengguna saat data baru diterima
    socket.on('chatMessage', async (message) => {
        console.log('Pesan chat diterima:', message);
        await sendTelegramMessage(message); // Pastikan ini benar
        socket.emit('chatMessage', 'Pesan diterima dan dikirim ke Telegram');
    });

    socket.on('disconnect', () => {
        console.log('Pengguna terputus');
    });
});


const excelExport = require('xlsx');

// Endpoint untuk mengekspor data logs menjadi file Excel
app.get('/export-logs', (req, res) => {
    // Query untuk mendapatkan log yang valid
    const sql = `
        SELECT k.pin, k.nama,  k.jabatan, l.cloud_id, l.type, l.scanTime
        FROM t_log l
        INNER JOIN karyawan k ON JSON_UNQUOTE(JSON_EXTRACT(l.original_data, '$.data.pin')) = k.pin
        WHERE l.type = 'attlog'
        AND l.scanTime IS NOT NULL
        AND l.scanTime != ''
    `;
    
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error fetching logs:', error);
            return res.status(500).json({ error: 'Error fetching logs' });
        }

        // Memeriksa apakah ada data yang diambil
        if (results.length === 0) {
            return res.status(404).json({ message: 'Tidak ada data log untuk diekspor' });
        }

        // Membuat worksheet dari hasil query
        const worksheet = excelExport.utils.json_to_sheet(results, {
            header: ['pin',  'nama', 'jabatan', 'cloud_id', 'type','scanTime']
        });
        const workbook = excelExport.utils.book_new();
        excelExport.utils.book_append_sheet(workbook, worksheet, 'Logs');

        // Mengonversi workbook menjadi file buffer
        const buffer = excelExport.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Mengirim file Excel sebagai respon
        res.setHeader('Content-Disposition', 'attachment; filename="logs.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    });
});

app.get('/log', (req, res) => {
    db.query('SELECT * FROM t_log ORDER BY created_at DESC', (err, results) => {
        if (err) {
            console.error('Error fetching logs:', err);
            return res.status(500).json({ error: 'Failed to fetch logs' });
        }
        res.json(results);
    });
});

// Mulai server
server.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
