const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let cameraProcess = null;
let isStreaming = false;
let currentFrame = null;
let useLibCamera = false;

// Ensure photos directory exists
const photosDir = path.join(__dirname, '..', 'public', 'photos');
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
}

// Check which camera system is available
function checkCameraSystem() {
    return new Promise((resolve) => {
        // Check for rpicam-jpeg (newest)
        exec('which rpicam-jpeg', (error) => {
            if (!error) {
                console.log('Using rpicam system (newest)');
                useLibCamera = true;
                resolve('rpicam');
            } else {
                // Check for libcamera-jpeg (newer)
                exec('which libcamera-jpeg', (error2) => {
                    if (!error2) {
                        console.log('Using libcamera system');
                        useLibCamera = true;
                        resolve('libcamera');
                    } else {
                        // Check for raspistill (legacy)
                        exec('which raspistill', (error3) => {
                            if (!error3) {
                                console.log('Using legacy raspistill');
                                useLibCamera = false;
                                resolve('raspistill');
                            } else {
                                console.error('No camera system found. Please install rpicam-apps or enable legacy camera.');
                                resolve(null);
                            }
                        });
                    }
                });
            }
        });
    });
}

// Initialize camera system check
checkCameraSystem();

/**
 * Start camera streaming
 */
function startStream() {
    if (isStreaming) {
        console.log('Camera already streaming');
        return { success: true, message: 'Camera already streaming' };
    }

    try {
        if (useLibCamera) {
            // Use rpicam-vid or libcamera-vid for streaming
            // Try rpicam-vid first, fall back to libcamera-vid
            const vidCommand = fs.existsSync('/usr/bin/rpicam-vid') ? 'rpicam-vid' : 'libcamera-vid';

            cameraProcess = spawn(vidCommand, [
                '-t', '0',              // Run indefinitely
                '--width', '1280',      // Width
                '--height', '720',      // Height
                '--framerate', '10',    // 10 fps
                '--codec', 'mjpeg',     // MJPEG codec
                '-o', '-',              // Output to stdout
                '--nopreview',          // No preview
                '-n'                    // No banner
            ]);

            console.log(`Starting camera stream with ${vidCommand}`);
        } else {
            // Use raspistill in timelapse mode for streaming
            cameraProcess = spawn('raspistill', [
                '-t', '0',              // Run indefinitely
                '-w', '1280',           // Width
                '-h', '720',            // Height
                '-q', '15',             // Quality (lower for faster streaming)
                '-o', '-',              // Output to stdout
                '-tl', '100',           // Timelapse interval (100ms)
                '-n'                    // No preview
            ]);

            console.log('Starting camera stream with raspistill');
        }

        cameraProcess.stdout.on('data', (data) => {
            currentFrame = data;
        });

        cameraProcess.stderr.on('data', (data) => {
            console.log('Camera stderr:', data.toString());
        });

        cameraProcess.on('error', (error) => {
            console.error('Camera process error:', error);
            isStreaming = false;
            cameraProcess = null;
        });

        cameraProcess.on('close', (code) => {
            console.log(`Camera process exited with code ${code}`);
            isStreaming = false;
            cameraProcess = null;
            currentFrame = null;
        });

        isStreaming = true;
        console.log('Camera streaming started');
        return { success: true, message: 'Camera streaming started' };

    } catch (error) {
        console.error('Error starting camera:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Stop camera streaming
 */
function stopStream() {
    if (cameraProcess) {
        cameraProcess.kill('SIGTERM');
        cameraProcess = null;
    }
    isStreaming = false;
    currentFrame = null;
    console.log('Camera streaming stopped');
    return { success: true, message: 'Camera streaming stopped' };
}

/**
 * Get current frame
 */
function getCurrentFrame() {
    return currentFrame;
}

/**
 * Check if streaming
 */
function getStreamingStatus() {
    return isStreaming;
}

/**
 * Capture a single photo
 */
async function capturePhoto() {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const filename = `photo_${timestamp}.jpg`;
        const filepath = path.join(photosDir, filename);

        let captureProcess;

        if (useLibCamera) {
            // Use rpicam-jpeg or libcamera-jpeg for high-quality still image
            const jpegCommand = fs.existsSync('/usr/bin/rpicam-jpeg') ? 'rpicam-jpeg' : 'libcamera-jpeg';

            captureProcess = spawn(jpegCommand, [
                '-o', filepath,
                '--width', '1920',
                '--height', '1080',
                '-q', '85',
                '-t', '500',
                '--nopreview',
                '-n'
            ]);

            console.log(`Capturing photo with ${jpegCommand}`);
        } else {
            // Capture a high-quality still image with raspistill
            captureProcess = spawn('raspistill', [
                '-o', filepath,
                '-w', '1920',
                '-h', '1080',
                '-q', '85',
                '-t', '500',
                '-n'
            ]);

            console.log('Capturing photo with raspistill');
        }

        captureProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(filepath)) {
                resolve({
                    success: true,
                    filename: filename,
                    url: `/photos/${filename}`,
                    message: 'Photo captured successfully'
                });
            } else {
                reject(new Error('Failed to capture photo'));
            }
        });

        captureProcess.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Get list of captured photos
 */
function getPhotos() {
    try {
        const files = fs.readdirSync(photosDir);
        const photos = files
            .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
            .map(file => ({
                filename: file,
                url: `/photos/${file}`,
                timestamp: fs.statSync(path.join(photosDir, file)).mtime
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

        return { success: true, photos };
    } catch (error) {
        console.error('Error getting photos:', error);
        return { success: false, photos: [] };
    }
}

/**
 * Delete a photo
 */
function deletePhoto(filename) {
    try {
        const filepath = path.join(photosDir, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            return { success: true, message: 'Photo deleted' };
        } else {
            return { success: false, message: 'Photo not found' };
        }
    } catch (error) {
        console.error('Error deleting photo:', error);
        return { success: false, message: error.message };
    }
}

module.exports = {
    startStream,
    stopStream,
    getCurrentFrame,
    getStreamingStatus,
    capturePhoto,
    getPhotos,
    deletePhoto
};
