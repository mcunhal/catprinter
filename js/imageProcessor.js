// Image processor for MXW01 printer
import { logger } from './logger.js';
import { PRINTER_WIDTH } from './printer.js';

export class ImageProcessor {
    constructor() {
        this.currentImage = null;
        this.cache = null;
        this.settings = {
            ditherMethod: 'floydSteinberg',
            threshold: 128,
            invert: false,
            width: PRINTER_WIDTH,
            autoscale: true,
            padding: 10,
            rotation: 0 // Rotation in degrees (0, 90, 180, 270)
        };
    }

    async loadImage(fileOrUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                // logger.info(`Image loaded: ${img.width}x${img.height}px`); // Too noisy for multiple blocks
                this.currentImage = img;
                this.cache = null;
                resolve(img);
            };

            img.onerror = (err) => {
                logger.error('Failed to load image', { error: err.message });
                reject(new Error('Failed to load image'));
            };

            if (typeof fileOrUrl === 'string') {
                img.src = fileOrUrl;
            } else if (fileOrUrl instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => { img.src = e.target.result; };
                reader.onerror = (e) => { reject(new Error('Failed to read file')); };
                reader.readAsDataURL(fileOrUrl);
            } else {
                reject(new Error('Invalid input: expected File or URL string'));
            }
        });
    }

    updateSettings(newSettings) {
        const oldSettings = {...this.settings};
        this.settings = {...this.settings, ...newSettings};
        
        const processingChanged =
            oldSettings.ditherMethod !== this.settings.ditherMethod ||
            oldSettings.threshold !== this.settings.threshold ||
            oldSettings.invert !== this.settings.invert ||
            oldSettings.rotation !== this.settings.rotation ||
            oldSettings.width !== this.settings.width ||
            oldSettings.autoscale !== this.settings.autoscale ||
            oldSettings.padding !== this.settings.padding;
        
        if (processingChanged) {
            this.cache = null;
        }

        return this.settings;
    }

    getSettings() {
        return {...this.settings};
    }

    processImage() {
        if (!this.currentImage) {
            return null;
        }
        
        if (this.cache) {
            return this.cache;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let destWidth = this.settings.width;
        let destHeight;

        const rotation = this.settings.rotation;
        const isRotated90or270 = (rotation === 90 || rotation === 270);

        if (this.settings.autoscale) {
            const aspectRatio = isRotated90or270 ?
                (this.currentImage.width / this.currentImage.height) :
                (this.currentImage.height / this.currentImage.width);
            destHeight = Math.round(destWidth * aspectRatio);
        } else {
            destWidth = Math.min(this.currentImage.width, PRINTER_WIDTH);
            destHeight = this.currentImage.height;

            if (isRotated90or270) {
                [destWidth, destHeight] = [destHeight, destWidth];
                if (destWidth > PRINTER_WIDTH) {
                    const scale = PRINTER_WIDTH / destWidth;
                    destWidth = PRINTER_WIDTH;
                    destHeight = Math.round(destHeight * scale);
                }
            }
        }

        const padding = this.settings.padding;

        if (isRotated90or270) {
            canvas.width = destWidth;
            canvas.height = destHeight + (padding * 2);
        } else {
            canvas.width = destWidth;
            canvas.height = destHeight + (padding * 2);
        }

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(destWidth / 2, padding + destHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);

        if (isRotated90or270) {
            ctx.drawImage(
                this.currentImage,
                0, 0, this.currentImage.width, this.currentImage.height,
                -destHeight / 2, -destWidth / 2, destHeight, destWidth
            );
        } else {
            ctx.drawImage(
                this.currentImage,
                0, 0, this.currentImage.width, this.currentImage.height,
                -destWidth / 2, -destHeight / 2, destWidth, destHeight
            );
        }
        ctx.restore();

        applyImageProcessing(canvas, this.settings);

        this.cache = canvas;
        return canvas;
    }

    getImageSummary() {
        if (!this.currentImage) return null;

        const canvas = this.processImage();
        if (!canvas) return null;

        return {
            originalWidth: this.currentImage.width,
            originalHeight: this.currentImage.height,
            processedWidth: canvas.width,
            processedHeight: canvas.height,
            aspectRatio: (this.currentImage.width / this.currentImage.height).toFixed(2),
            ditherMethod: this.settings.ditherMethod,
            threshold: this.settings.threshold,
            invert: this.settings.invert,
            rotation: this.settings.rotation
        };
    }

    resetSettings() {
        this.settings = {
            ditherMethod: 'floydSteinberg',
            threshold: 128,
            invert: false,
            width: PRINTER_WIDTH,
            autoscale: true,
            padding: 10,
            rotation: 0
        };
        this.cache = null;
        return {...this.settings};
    }

    clearImage() {
        this.currentImage = null;
        this.cache = null;
    }
}

// === Helper Functions (Private to Module) ===

function applyImageProcessing(canvas, settings) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Grayscale
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (settings.invert) {
            luminance = 255 - luminance;
        }
        
        data[i] = data[i + 1] = data[i + 2] = luminance;
    }
    
    // Dithering
    switch (settings.ditherMethod) {
        case 'threshold':
            applyThreshold(imageData, settings.threshold);
            break;
        case 'floydSteinberg':
            applyFloydSteinberg(imageData, settings.threshold);
            break;
        case 'atkinson':
            applyAtkinson(imageData, settings.threshold);
            break;
        case 'halftone':
            applyHalftone(imageData, settings.threshold);
            break;
        case 'none':
            break;
        default:
            applyThreshold(imageData, settings.threshold);
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applyThreshold(imageData, threshold) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const v = data[i] < threshold ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = v;
    }
}

function applyFloydSteinberg(imageData, threshold) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const luminance = new Float32Array(width * height);
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const idx = (i * width + j) * 4;
            luminance[i * width + j] = data[idx];
        }
    }
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const idx = i * width + j;
            const oldPixel = luminance[idx];
            const newPixel = oldPixel < threshold ? 0 : 255;
            luminance[idx] = newPixel;
            
            const error = oldPixel - newPixel;
            
            if (j + 1 < width) {
                luminance[idx + 1] += error * 7 / 16;
            }
            if (i + 1 < height) {
                if (j - 1 >= 0) {
                    luminance[(i + 1) * width + j - 1] += error * 3 / 16;
                }
                luminance[(i + 1) * width + j] += error * 5 / 16;
                if (j + 1 < width) {
                    luminance[(i + 1) * width + j + 1] += error * 1 / 16;
                }
            }
        }
    }
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const idx = (i * width + j) * 4;
            const v = luminance[i * width + j];
            data[idx] = data[idx + 1] = data[idx + 2] = v;
        }
    }
}

function applyAtkinson(imageData, threshold) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    const luminance = new Array(width * height);
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const idx = (i * width + j) * 4;
            luminance[i * width + j] = data[idx];
        }
    }
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const idx = i * width + j;
            const oldPixel = luminance[idx];
            const newPixel = oldPixel < threshold ? 0 : 255;
            luminance[idx] = newPixel;
            
            const error = Math.floor((oldPixel - newPixel) / 8);
            
            if (j + 1 < width) luminance[idx + 1] += error;
            if (j + 2 < width) luminance[idx + 2] += error;
            
            if (i + 1 < height) {
                if (j - 1 >= 0) luminance[(i + 1) * width + j - 1] += error;
                luminance[(i + 1) * width + j] += error;
                if (j + 1 < width) luminance[(i + 1) * width + j + 1] += error;
            }
            
            if (i + 2 < height) {
                luminance[(i + 2) * width + j] += error;
            }
        }
    }
    
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const idx = (i * width + j) * 4;
            const v = luminance[i * width + j];
            data[idx] = data[idx + 1] = data[idx + 2] = v;
        }
    }
}

function applyHalftone(imageData, threshold) {
    const width = imageData.width;
    const data = imageData.data;
    
    const bayerMatrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];
    
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            bayerMatrix[i][j] = Math.floor(bayerMatrix[i][j] * 255 / 16);
        }
    }
    
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const i = y % 4;
            const j = x % 4;
            
            const thresh = bayerMatrix[i][j];
            data[idx] = data[idx + 1] = data[idx + 2] = (data[idx] < thresh) ? 0 : 255;
        }
    }
}
