import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { Blob } from 'blob-polyfill';
import canvas from 'canvas';

// Mock Browser Environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.self = global.window;
global.Blob = Blob;
global.Image = canvas.Image; // Use node-canvas Image
global.HTMLCanvasElement = canvas.Canvas;
global.HTMLImageElement = canvas.Image;

// Mock URL.createObjectURL
const blobRegistry = new Map();
const mockURL = {
    createObjectURL: (blob) => {
        const uuid = Math.random().toString(36).substring(2);
        const url = `blob:nodedata:${uuid}`;
        blobRegistry.set(url, blob);
        return url;
    },
    revokeObjectURL: (url) => {
        blobRegistry.delete(url);
    }
};

global.URL = mockURL;
dom.window.URL = mockURL; // Patch JSDOM window.URL
dom.window.Image = canvas.Image; // Patch JSDOM window.Image
dom.window.HTMLImageElement = canvas.Image;
dom.window.HTMLCanvasElement = canvas.Canvas;

// Configuration
const INPUT_FILE = 'public/assets/models/CSE-front-ar-ios-safe.glb'; // Use SAFE version (No Draco)
const OUTPUT_FILE = 'public/assets/models/CSE-front-ar.usdz';

async function convert() {
    console.log('🔧 Initializing environment...');

    // Dynamic Imports to ensure mocks are applied first
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');

    // Patch ImageLoader to handle Blob URLs using canvas
    THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
        console.log(`🖼️ Loading image: ${url.substring(0, 50)}...`);
        if (url.startsWith('blob:nodedata:')) {
            const blob = blobRegistry.get(url);
            if (blob) {
                // Convert Blob to Buffer
                blob.arrayBuffer().then(arrayBuffer => {
                    console.log('📦 Blob loaded, converting to Image...');
                    const buffer = Buffer.from(arrayBuffer);
                    const img = new canvas.Image();
                    img.onload = () => {
                        console.log('✅ Image loaded successfully');
                        onLoad(img);
                    };
                    img.onerror = (err) => {
                        console.error('❌ Canvas Image Load Error:', err);
                        if (onError) onError(err);
                    };
                    img.src = buffer;
                });
            } else {
                console.error(`❌ Blob not found: ${url}`);
                if (onError) onError(new Error(`Blob not found: ${url}`));
            }
        } else {
            // Fallback for regular URLs
            const img = new canvas.Image();
            img.onload = () => onLoad(img);
            img.onerror = (err) => {
                if (onError) onError(err);
            };
            img.src = url;
        }
        return new canvas.Image(); // Return dummy image immediately
    };

    console.log(`🔄 Starting conversion: ${INPUT_FILE} -> ${OUTPUT_FILE}`);

    // 1. Load GLB
    const loader = new GLTFLoader();

    // Keep Node.js alive
    const keepAlive = setInterval(() => { }, 1000);

    try {
        // Read file buffer
        const buffer = fs.readFileSync(INPUT_FILE);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        console.log('📂 Parsing GLB...');

        // Parse directly
        loader.parse(arrayBuffer, '', async (gltf) => {
            console.log('✅ GLB Loaded. Exporting to USDZ...');

            try {
                const exporter = new USDZExporter();
                const usdz = await exporter.parse(gltf.scene);

                fs.writeFileSync(OUTPUT_FILE, Buffer.from(usdz));
                console.log(`🎉 Success! Saved to ${OUTPUT_FILE}`);
                console.log(`📊 Size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);

                clearInterval(keepAlive);
                process.exit(0);
            } catch (exportErr) {
                console.error('❌ Error exporting USDZ:', exportErr);
                clearInterval(keepAlive);
                process.exit(1);
            }
        }, (err) => {
            console.error('❌ Error parsing GLB:', err);
            clearInterval(keepAlive);
            process.exit(1);
        });

    } catch (err) {
        console.error('❌ Error reading file:', err);
        clearInterval(keepAlive);
        process.exit(1);
    }
}

convert();
