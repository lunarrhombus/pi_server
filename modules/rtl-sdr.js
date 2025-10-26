const { spawn } = require('child_process');

let rtlProcess = null;
let dataCallback = null;

/**
 * Start RTL-SDR data streaming
 * @param {Object} config - Configuration object
 * @param {number} config.frequency - Frequency in Hz
 * @param {number} config.sampleRate - Sample rate in Hz
 * @param {number} config.gain - Gain in dB (0 for auto)
 * @param {Function} callback - Callback function to receive data
 */
function startStream(config, callback) {
    if (rtlProcess) {
        console.log('RTL-SDR process already running, stopping first...');
        stopStream();
    }

    dataCallback = callback;

    const { frequency, sampleRate, gain } = config;

    // Build rtl_sdr command arguments
    const args = [
        '-f', frequency.toString(),
        '-s', sampleRate.toString(),
        '-g', gain.toString(),
        '-'  // Output to stdout
    ];

    console.log('Starting RTL-SDR with command:', 'rtl_sdr', args.join(' '));

    try {
        // Spawn rtl_sdr process
        rtlProcess = spawn('rtl_sdr', args);

        rtlProcess.stdout.on('data', (data) => {
            // Process the binary data from RTL-SDR
            if (dataCallback) {
                const sdrData = processSDRData(data, config);
                dataCallback(sdrData);
            }
        });

        rtlProcess.stderr.on('data', (data) => {
            const message = data.toString();
            console.log('RTL-SDR stderr:', message);

            // Send status messages to client
            if (dataCallback) {
                dataCallback({
                    type: 'status',
                    message: message.trim()
                });
            }
        });

        rtlProcess.on('error', (error) => {
            console.error('RTL-SDR process error:', error);
            if (dataCallback) {
                dataCallback({
                    type: 'error',
                    message: error.message
                });
            }
        });

        rtlProcess.on('close', (code) => {
            console.log(`RTL-SDR process exited with code ${code}`);
            rtlProcess = null;
            if (dataCallback) {
                dataCallback({
                    type: 'status',
                    message: `Process stopped (exit code: ${code})`
                });
            }
        });

    } catch (error) {
        console.error('Error starting RTL-SDR:', error);
        if (dataCallback) {
            dataCallback({
                type: 'error',
                message: `Failed to start RTL-SDR: ${error.message}`
            });
        }
    }
}

/**
 * Process raw SDR data
 * @param {Buffer} data - Raw binary data from rtl_sdr
 * @param {Object} config - Configuration used for the stream
 * @returns {Object} Processed data object
 */
function processSDRData(data, config) {
    // RTL-SDR outputs IQ samples as unsigned 8-bit integers
    // Each sample consists of 2 bytes: I and Q
    const samples = [];

    // Process in chunks to avoid overwhelming the client
    const maxSamples = 1024;
    const numSamples = Math.min(data.length / 2, maxSamples);

    for (let i = 0; i < numSamples * 2; i += 2) {
        // Convert unsigned 8-bit to signed values centered around 0
        const i_sample = (data[i] - 127.5) / 127.5;
        const q_sample = (data[i + 1] - 127.5) / 127.5;

        samples.push({
            i: i_sample,
            q: q_sample,
            magnitude: Math.sqrt(i_sample * i_sample + q_sample * q_sample)
        });
    }

    // Calculate some statistics
    const magnitudes = samples.map(s => s.magnitude);
    const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const maxMagnitude = Math.max(...magnitudes);

    return {
        type: 'data',
        timestamp: Date.now(),
        frequency: config.frequency,
        sampleRate: config.sampleRate,
        numSamples: samples.length,
        samples: samples.slice(0, 256), // Send subset to client
        stats: {
            avgMagnitude: avgMagnitude.toFixed(4),
            maxMagnitude: maxMagnitude.toFixed(4),
            bytesReceived: data.length
        }
    };
}

/**
 * Stop RTL-SDR data streaming
 */
function stopStream() {
    if (rtlProcess) {
        console.log('Stopping RTL-SDR process...');
        rtlProcess.kill('SIGTERM');
        rtlProcess = null;
        dataCallback = null;
    }
}

/**
 * Check if RTL-SDR is available on the system
 * @returns {Promise<boolean>} True if rtl_sdr is available
 */
async function checkAvailability() {
    return new Promise((resolve) => {
        const testProcess = spawn('rtl_test', ['-t']);

        testProcess.on('error', () => {
            resolve(false);
        });

        testProcess.on('close', (code) => {
            resolve(code === 0);
        });

        // Kill after 2 seconds
        setTimeout(() => {
            testProcess.kill();
            resolve(false);
        }, 2000);
    });
}

module.exports = {
    startStream,
    stopStream,
    checkAvailability
};
