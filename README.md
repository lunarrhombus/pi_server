# Raspberry Pi Server with RTL-SDR Integration

A secure Node.js web server designed for Raspberry Pi 3 that provides real-time RTL-SDR data visualization with password protection.

## Features

- Password-protected web interface
- Real-time RTL-SDR data streaming using WebSockets
- Responsive web design
- Session-based authentication
- Welcome dashboard
- RTL-SDR monitoring page with configurable frequency, sample rate, and gain

## Prerequisites

### On Your Laptop (Development)
- Node.js (v14 or higher)
- npm or yarn

### On Your Raspberry Pi
- Raspberry Pi 3 (or compatible)
- Raspbian/Raspberry Pi OS
- Node.js installed
- RTL-SDR USB device
- RTL-SDR tools installed

## Installation

### 1. Install RTL-SDR Tools on Raspberry Pi

```bash
sudo apt-get update
sudo apt-get install rtl-sdr
```

Verify installation:
```bash
rtl_test -t
```

### 2. Clone/Copy Project to Raspberry Pi

Transfer the project files to your Raspberry Pi:

```bash
# On your laptop, compress the project
# Then on your Pi:
scp -r pi_server/ pi@<your-pi-ip>:~/
```

Or use git if you're using version control:
```bash
git clone <your-repo-url>
cd pi_server
```

### 3. Install Dependencies

On the Raspberry Pi:
```bash
npm install
```

### 4. Configure Environment Variables

Generate a password hash:
```bash
npm run generate-hash
```

Enter your desired password when prompted. Copy the generated hash.

Create a `.env` file:
```bash
cp .env.example .env
nano .env
```

Update the `.env` file with your settings:
```
PORT=3000
SESSION_SECRET=your-random-secret-key-here
PASSWORD_HASH=<paste-the-hash-you-generated>
```

## Running the Server

### Start the server:
```bash
npm start
```

The server will start on port 3000 (or the port you specified in .env).

### Access the server:

**On your local network:**
```
http://<raspberry-pi-ip>:3000
```

**On the Pi itself:**
```
http://localhost:3000
```

## Accessing from Anywhere

To access your Pi server from anywhere, you have several options:

### Option 1: Port Forwarding (Recommended for home networks)

1. Log into your router's admin panel
2. Set up port forwarding:
   - External Port: 3000 (or any port you choose)
   - Internal IP: Your Pi's local IP address
   - Internal Port: 3000
3. Find your public IP address: `curl ifconfig.me`
4. Access via: `http://<your-public-ip>:3000`

**Security Note:** Consider using a reverse proxy with HTTPS (like nginx with Let's Encrypt) for production use.

### Option 2: Cloudflare Tunnel (Easy & Secure)

1. Install cloudflared on your Pi
2. Create a tunnel to your local server
3. Access via the provided Cloudflare URL

### Option 3: VPN (Most Secure)

Set up a VPN server on your Pi (like WireGuard or OpenVPN) and connect to your home network remotely.

## Project Structure

```
pi_server/
├── server.js              # Main Express server
├── generateHash.js        # Password hash generator
├── package.json          # Project dependencies
├── .env                  # Environment variables (create this)
├── .env.example          # Example environment file
├── views/                # HTML pages
│   ├── login.html       # Login page
│   ├── index.html       # Welcome/home page
│   └── sdr.html         # RTL-SDR monitoring page
├── modules/             # Server modules
│   └── rtl-sdr.js      # RTL-SDR integration
├── public/              # Static assets (if needed)
└── README.md           # This file
```

## Usage

### Login
1. Navigate to your server URL
2. You'll be redirected to the login page
3. Enter your password
4. You'll be logged in for 24 hours

### RTL-SDR Monitoring
1. Navigate to the SDR page from the home page
2. Configure your settings:
   - **Frequency:** The frequency to tune to (in Hz, e.g., 100000000 for 100 MHz)
   - **Sample Rate:** Sampling rate (e.g., 2048000 for 2.048 MS/s)
   - **Gain:** Gain setting (0 for automatic)
3. Click "Start Monitoring"
4. Real-time data will appear in the activity log

## RTL-SDR Configuration Tips

### Common Frequencies to Try:
- **FM Radio:** 88-108 MHz (e.g., 100000000 Hz)
- **Weather Satellites (NOAA):** 137 MHz
- **Air Traffic:** 118-137 MHz
- **Amateur Radio 2m:** 144-148 MHz

### Sample Rates:
- **2.048 MS/s:** Good general purpose rate
- **250 KS/s:** Lower rate for narrow signals
- **1.024 MS/s:** Medium rate

### Gain:
- **0:** Automatic gain control
- **10-50:** Manual gain in dB (device dependent)

## Troubleshooting

### RTL-SDR not detected
```bash
# Check if device is recognized
lsusb

# Test RTL-SDR
rtl_test

# Check permissions
sudo usermod -a -G plugdev $USER
```

### Port already in use
Change the PORT in your `.env` file to a different value.

### Can't access from other devices
- Check your Pi's firewall settings
- Ensure the Pi and your device are on the same network
- Verify the correct IP address

### Performance issues
- Reduce the sample rate
- Use a powered USB hub for the RTL-SDR
- Ensure your Pi has adequate cooling

## Security Considerations

- Change the default SESSION_SECRET in .env
- Use a strong password
- Consider setting up HTTPS with a reverse proxy
- Keep your .env file secure and never commit it to version control
- Regularly update dependencies: `npm update`

## Running on Boot (Optional)

To make the server start automatically on boot, you can use PM2:

```bash
# Install PM2
sudo npm install -g pm2

# Start your app with PM2
pm2 start server.js --name pi-server

# Save the PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Follow the instructions provided by the command above
```

## Development

When developing on your laptop, you can test without RTL-SDR hardware. The server will still run, but the SDR functionality won't work without the actual device.

## License

ISC

## Support

For issues or questions, check the RTL-SDR documentation or Node.js resources.
