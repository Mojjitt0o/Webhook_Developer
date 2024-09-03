// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const mysql = require('mysql');
// const axios = require('axios');

// const app = express();
// const port = 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());
// app.use(express.static('public'));

// // MySQL connection
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'webhook'
// });

// db.connect((err) => {
//     if (err) {
//         console.error('Connection error:', err);
//         return;
//     }
//     console.log('Connected to MySQL');
// });

// // Helper untuk memanggil API eksternal
// async function callApi(endpoint, data, res) {
//     const apiBaseUrl = 'https://developer.fingerspot.io/api/';
//     const authorization = 'Bearer SZS7NOV9IBE4TJTI';  // Authorization token
    
//     try {
//         const response = await axios.post(`${apiBaseUrl}${endpoint}`, data, {
//             headers: {
//                 'Content-Type': 'application/json',
//                 'Authorization': authorization
//             }
//         });
//         res.json(response.data);
//     } catch (error) {
//         console.error(`Error calling ${endpoint}:`, error);
//         res.status(500).json({ error: 'API call failed' });
//     }
// }

// // Endpoint generik untuk API Fingerspot
// app.post('/api/fingerspot', (req, res) => {
//     const { endpoint, ...data } = req.body;  // Ambil 'endpoint' dan data lainnya dari body
    
//     if (!endpoint) {
//         return res.status(400).json({ error: 'Endpoint is required' });
//     }
    
//     // Panggil API sesuai endpoint yang diminta
//     callApi(endpoint, data, res);
// });

// // Log routes
// app.get('/log', (req, res) => {
//     db.query('SELECT * FROM t_log', (error, results) => {
//         if (error) {
//             return res.status(500).json({ error: error.message });
//         }
//         res.json(results);
//     });
// });

// // Store route
// app.post('/store', (req, res) => {
//     const original_data = JSON.stringify(req.body);
//     const { type, cloud_id } = req.body;
//     const created_at = new Date();

//     if (type && cloud_id) {
//         const sql = "INSERT INTO t_log (cloud_id, type, created_at, original_data) VALUES (?, ?, ?, ?)";
//         db.query(sql, [cloud_id, type, created_at, original_data], (error, results) => {
//             if (error) {
//                 return res.status(500).json({ error: error.message });
//             }
//             res.json({ message: 'Data stored successfully' });
//         });
//     } else {
//         res.status(400).json({ error: 'Invalid data' });
//     }
// });

// // Default route
// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/public/index.html');
// });

// // Start server
// app.listen(port, () => {
//     console.log(`Server running at http://localhost:${port}`);
// });


//--------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'webhook'
});

db.connect((err) => {
    if (err) {
        console.error('Connection error:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Create karyawan table if not exists
const createTableQuery = `
CREATE TABLE IF NOT EXISTS karyawan (
    pin VARCHAR(255) PRIMARY KEY,
    cloud_id VARCHAR(255) NOT NULL,
    nama VARCHAR(255) NOT NULL,
    jabatan VARCHAR(255)
);
`;

db.query(createTableQuery, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('Table `karyawan` is ready');
    }
});

// Telegram bot token and chat ID
const TELEGRAM_BOT_TOKEN = '7390265210:AAFAFKwsl8OVe-VvCafxVBGhfaQCiQNWsFg'; // Ganti dengan token bot Anda
const CHAT_ID = '1421950780'; // Ganti dengan chat ID atau grup ID Anda

// Function to send a message to Telegram
async function sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    console.log('Attempting to send message to Telegram...');

    try {
        const response = await axios.post(url, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('Telegram response:', response.data);
        if (response.data.ok) {
            console.log('Message sent successfully');
        } else {
            console.error('Failed to send message:', response.data.description);
        }
    } catch (error) {
        console.error('Error sending message to Telegram:', {
            message: error.message,
            response: error.response ? error.response.data : 'No response data'
        });
    }
}

// Store route with Telegram notification and optional endpoint notification
app.post('/store', (req, res) => {
    console.log('Received request at /store with body:', req.body); // Debugging entire request body
    const original_data = JSON.stringify(req.body);
    const { type, cloud_id, data, notification_endpoint } = req.body;
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (type && cloud_id && data && data.pin) { // Check if data and pin are present
        const sql = "INSERT INTO t_log (cloud_id, type, created_at, original_data) VALUES (?, ?, ?, ?)";
        db.query(sql, [cloud_id, type, created_at, original_data], (error, results) => {
            if (error) {
                console.error('Error inserting log:', error);
                return res.status(500).json({ error: error.message });
            }
            console.log('Log entry inserted successfully');

            const pin = data.pin;

            // Query using the pin
            const pinVerificationSql = "SELECT nama, jabatan FROM karyawan WHERE pin = ?";
            db.query(pinVerificationSql, [pin], (pinError, pinResults) => {
                if (pinError) {
                    console.error('Error querying pin data:', pinError);
                    return res.status(500).json({ error: 'Error querying pin data' });
                }

                let name = 'Unknown';
                let jabatan = 'Unknown';
                if (pinResults.length > 0) {
                    name = pinResults[0].nama;   // Assigning to existing variables
                    jabatan = pinResults[0].jabatan;
                }

                const message = `
<b>New Log Entry</b>
<b>Cloud ID:</b> ${cloud_id}
<b>Type:</b> ${type}
<b>Created At:</b> ${created_at}
<b>Original Data:</b> <pre>${original_data}</pre>
<b>Name:</b> ${name}
<b>Jabatan:</b> ${jabatan}
                `;
                console.log('Sending message to Telegram:', message);
                sendTelegramMessage(message);

                if (notification_endpoint) {
                    console.log('Sending endpoint notification to:', notification_endpoint);
                    sendEndpointNotification(notification_endpoint, { cloud_id, type, created_at, original_data, name, jabatan });
                }

                res.json({ message: 'Data stored successfully' });
            });
        });
    } else {
        console.error('Invalid data or pin missing:', req.body);
        res.status(400).json({ error: 'Invalid data or pin missing' });
    }
});



// Setup Multer for file upload
const upload = multer({ dest: 'uploads/' });

// Endpoint to upload Excel file
app.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
    const filePath = req.file.path;
    console.log('File uploaded:', filePath);

    try {
        // Read the Excel file
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Get the first sheet
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log('Excel data:', data);

        const queries = [];
        let insertedEmployees = [];

        data.forEach((row) => {
            const { pin, cloud_id, nama, jabatan } = row;
            console.log('Processing row:', { pin, cloud_id, nama, jabatan });

            if (pin && cloud_id && nama) {
                const sql = `
                    INSERT INTO karyawan (pin, cloud_id, nama, jabatan) 
                    VALUES (?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE 
                        cloud_id = VALUES(cloud_id), 
                        nama = VALUES(nama), 
                        jabatan = VALUES(jabatan)
                `;
                queries.push(new Promise((resolve, reject) => {
                    db.query(sql, [pin, cloud_id, nama, jabatan], (error, results) => {
                        if (error) {
                            console.error('Error inserting data:', error);
                            reject(error);
                        } else {
                            console.log('Employee inserted/updated:', nama);
                            insertedEmployees.push({ pin, cloud_id, nama, jabatan });
                            resolve();
                        }
                    });
                }));
            }
        });

        // Wait for all queries to finish
        await Promise.all(queries);

        // Clean up the uploaded file
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
        });

        // Send Telegram notification
        if (insertedEmployees.length > 0) {
            let message = '<b>Employees Processed:</b>\n';
            insertedEmployees.forEach(emp => {
                message += `<b>PIN:</b> ${emp.pin} <b>Cloud ID:</b> ${emp.cloud_id} <b>Nama:</b> ${emp.nama} <b>Jabatan:</b> ${emp.jabatan}\n`;
            });
            console.log('Sending employees processed message to Telegram:', message);
            await sendTelegramMessage(message);
        }

        res.json({ message: 'File processed and data inserted successfully' });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: 'Error processing file' });
    }
});

// Log fetching route
app.get('/log', (req, res) => {
    console.log('Fetching logs from database...');
    const sql = 'SELECT * FROM t_log';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error fetching logs:', error);
            return res.status(500).json({ error: 'Failed to fetch logs' });
        }
        console.log('Logs fetched successfully:', results);
        res.json(results);
    });
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});



//----------------------------

// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const mysql = require('mysql');
// const axios = require('axios');

// const app = express();
// const port = 3000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());
// app.use(express.static('public'));

// // MySQL connection
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'webhook'
// });

// db.connect((err) => {
//     if (err) {
//         console.error('Connection error:', err);
//         return;
//     }
//     console.log('Connected to MySQL');
// });

// // Telegram bot token and chat ID
// const TELEGRAM_BOT_TOKEN = '7390265210:AAFAFKwsl8OVe-VvCafxVBGhfaQCiQNWsFg';
// const CHAT_ID = '1421950780';

// // Function to send a message to Telegram
// async function sendTelegramMessage(message) {
//     const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
//     try {
//         await axios.post(url, {
//             chat_id: CHAT_ID,
//             text: message,
//             parse_mode: 'HTML' // Optional: format message with HTML
//         });
//     } catch (error) {
//         console.error('Error sending message to Telegram:', error);
//     }
// }

// // Function to send notifications to external endpoint
// async function sendEndpointNotification(endpoint, data) {
//     try {
//         const response = await axios.post(endpoint, data, {
//             headers: {
//                 'Content-Type': 'application/json',
//             }
//         });
//         console.log('Notification sent to endpoint:', response.data);
//     } catch (error) {
//         console.error('Error sending notification to endpoint:', error);
//     }
// }

// // Store route with Telegram notification and optional endpoint notification
// app.post('/store', (req, res) => {
//     const original_data = JSON.stringify(req.body);
//     const { type, cloud_id, notification_endpoint } = req.body;
//     const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

//     if (type && cloud_id) {
//         const sql = "INSERT INTO t_log (cloud_id, type, created_at, original_data) VALUES (?, ?, ?, ?)";
//         db.query(sql, [cloud_id, type, created_at, original_data], (error, results) => {
//             if (error) {
//                 return res.status(500).json({ error: error.message });
//             }

//             // Send Telegram notification
//             const message = `
// <b>New Log Entry</b>
// <b>Cloud ID:</b> ${cloud_id}
// <b>Type:</b> ${type}
// <b>Created At:</b> ${created_at}
// <b>Original Data:</b> <pre>${original_data}</pre>
//             `;
//             sendTelegramMessage(message);

//             // Optionally send notification to external endpoint
//             if (notification_endpoint) {
//                 sendEndpointNotification(notification_endpoint, { cloud_id, type, created_at, original_data });
//             }

//             res.json({ message: 'Data stored successfully' });
//         });
//     } else {
//         res.status(400).json({ error: 'Invalid data' });
//     }
// });

// // Log fetching route
// app.get('/log', (req, res) => {
//     const sql = 'SELECT * FROM t_log';
//     db.query(sql, (error, results) => {
//         if (error) {
//             console.error('Error fetching logs:', error);
//             return res.status(500).json({ error: 'Failed to fetch logs' });
//         }
//         res.json(results);
//     });
// });

// // Default route
// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/public/index.html');
// });

// // Start server
// app.listen(port, () => {
//     console.log(`Server running at http://localhost:${port}`);
// });
