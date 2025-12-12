const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = 8443;

// Serve static files from public directory
app.use(express.static('public'));

// Generate self-signed certificate if needed
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Generating self-signed certificate...');
    exec(`openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=localhost"`, (err) => {
        if (err) {
            console.error('Failed to generate certificate:', err);
            console.log('\nStarting HTTP server instead on port 3000...');
            app.listen(port, () => {
                console.log(`\n✅ Server running at http://localhost:${port}`);
                console.log('⚠️  Note: Camera access requires HTTPS. Use chrome://flags/#unsafely-treat-insecure-origin-as-secure');
            });
        } else {
            startHTTPS();
        }
    });
} else {
    startHTTPS();
}

function startHTTPS() {
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    https.createServer(options, app).listen(port, () => {
        console.log(`\n✅ HTTPS Server running!`);
        console.log(`🌐 Local: https://localhost:${port}`);
        console.log(`\n📱 Next steps:`);
        console.log(`   1. Accept the self-signed certificate warning`);
        console.log(`   2. Upload marker to public/assets/markers/target.mind`);
        console.log(`   3. Add 3D model to public/assets/models/model.glb`);
        console.log(`   4. Open on mobile device and grant camera permissions\n`);
    });
}
