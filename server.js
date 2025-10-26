require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const rtlSdrModule = require('./modules/rtl-sdr');

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
