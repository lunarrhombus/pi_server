require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const rtlSdrModule = require('./modules/rtl-sdr');
const piCamera = require('./modules/pi-camera');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Login route - GET
app.get('/login', (req, res) => {
    if (req.session.authenticated) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Login route - POST
app.post('/login', async (req, res) => {
    const { password } = req.body;

    try {
        // Compare password with hashed password from environment variable
        const isValid = await bcrypt.compare(password, process.env.PASSWORD_HASH);

        if (isValid) {
            req.session.authenticated = true;
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Protected routes
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/sdr', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'sdr.html'));
});

app.get('/camera', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'camera.html'));
});

// Reboot endpoint
app.post('/api/reboot', requireAuth, (req, res) => {
    const { exec } = require('child_process');

    res.json({ success: true, message: 'Rebooting Raspberry Pi...' });

    // Execute reboot command after sending response
    setTimeout(() => {
        exec('sudo reboot', (error) => {
            if (error) {
                console.error('Reboot error:', error);
            }
        });
    }, 1000);
});

// Shutdown endpoint
app.post('/api/shutdown', requireAuth, (req, res) => {
    const { exec } = require('child_process');

    res.json({ success: true, message: 'Shutting down Raspberry Pi...' });

    // Execute shutdown command after sending response
    setTimeout(() => {
        exec('sudo shutdown -h now', (error) => {
            if (error) {
                console.error('Shutdown error:', error);
            }
        });
    }, 1000);
});

// API endpoint for server stats
app.get('/api/server-stats', requireAuth, async (req, res) => {
    const os = require('os');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const uptime = os.uptime(); // System uptime in seconds
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = parseFloat(((usedMemory / totalMemory) * 100).toFixed(1));

    // Format uptime
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    let uptimeFormatted = '';
    if (days > 0) uptimeFormatted += `${days}d `;
    if (hours > 0 || days > 0) uptimeFormatted += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) uptimeFormatted += `${minutes}m `;
    uptimeFormatted += `${seconds}s`;

    // Get disk usage
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    let diskUsagePercent = 0;

    try {
        // Try to get disk usage (works on Linux/Mac)
        const { stdout } = await execPromise('df -k / | tail -1');
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 5) {
            diskTotal = parseInt(parts[1]) * 1024; // Convert KB to bytes
            diskUsed = parseInt(parts[2]) * 1024;
            diskFree = parseInt(parts[3]) * 1024;
            diskUsagePercent = parseFloat(((diskUsed / diskTotal) * 100).toFixed(1));
        }
    } catch (error) {
        console.error('Error getting disk usage:', error.message);
        // Default values if command fails
        diskTotal = 0;
        diskUsed = 0;
        diskFree = 0;
        diskUsagePercent = 0;
    }

    res.json({
        uptime: uptimeFormatted,
        uptimeSeconds: uptime,
        serverTime: new Date().toISOString(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
        freeMemory: (freeMemory / 1024 / 1024 / 1024).toFixed(2),
        usedMemory: (usedMemory / 1024 / 1024 / 1024).toFixed(2),
        memoryUsagePercent: memoryUsagePercent,
        totalDisk: (diskTotal / 1024 / 1024 / 1024).toFixed(2),
        freeDisk: (diskFree / 1024 / 1024 / 1024).toFixed(2),
        usedDisk: (diskUsed / 1024 / 1024 / 1024).toFixed(2),
        diskUsagePercent: diskUsagePercent
    });
});

// Camera API endpoints
app.post('/api/camera/start', requireAuth, (req, res) => {
    const result = piCamera.startStream();
    res.json(result);
});

app.post('/api/camera/stop', requireAuth, (req, res) => {
    const result = piCamera.stopStream();
    res.json(result);
});

app.get('/api/camera/stream', requireAuth, (req, res) => {
    const frame = piCamera.getCurrentFrame();
    if (frame) {
        res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.end(frame);
    } else {
        res.status(404).send('No frame available');
    }
});

app.get('/api/camera/placeholder', (req, res) => {
    // Send a simple placeholder SVG
    const svg = `<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <rect width="1280" height="720" fill="#1a1a2e"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-family="Arial" font-size="24" fill="#666">Camera Stopped</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
});

app.post('/api/camera/capture', requireAuth, async (req, res) => {
    try {
        const result = await piCamera.capturePhoto();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/camera/photos', requireAuth, (req, res) => {
    const result = piCamera.getPhotos();
    res.json(result);
});

app.delete('/api/camera/photo/:filename', requireAuth, (req, res) => {
    const result = piCamera.deletePhoto(req.params.filename);
    res.json(result);
});

// Socket.IO for real-time RTL-SDR data
io.use((socket, next) => {
    const sessionMiddleware = session({
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
        resave: false,
        saveUninitialized: false
    });
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
    console.log('Client connected to RTL-SDR stream');

    // Start RTL-SDR streaming when client requests it
    socket.on('start-sdr', (config) => {
        console.log('Starting RTL-SDR with config:', config);
        rtlSdrModule.startStream(config, (data) => {
            socket.emit('sdr-data', data);
        });
    });

    socket.on('stop-sdr', () => {
        console.log('Stopping RTL-SDR stream');
        rtlSdrModule.stopStream();
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected from RTL-SDR stream');
        rtlSdrModule.stopStream();
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
});
