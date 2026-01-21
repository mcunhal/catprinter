import { connectPrinter, printImage, getBatteryLevel, isPrinterConnected, getLastKnownBatteryLevel } from './printer.js';
import { renderTextToCanvas } from './textRenderer.js';
import { logger, setupLoggerUI } from './logger.js';
import * as imageProcessor from './imageProcessor.js';

// === DOM Elements ===
// Mode toggle
const textModeBtn = document.getElementById('textModeBtn');
const imageModeBtn = document.getElementById('imageModeBtn');
const textModeContent = document.getElementById('textModeContent');
const imageModeContent = document.getElementById('imageModeContent');

// Battery indicator elements
const batteryIndicator = document.getElementById('batteryIndicator');
const batteryLevel = document.getElementById('batteryLevel');
const batteryIcon = document.querySelector('.battery-icon');

// Text Mode Elements
const connectTextBtn = document.getElementById('connectTextBtn');
const printTextBtn = document.getElementById('printTextBtn');
const resetBtn = document.getElementById('resetBtn');
// Settings
const printDensityInput = document.getElementById('printDensity');
const printDensityDisplay = document.getElementById('printDensityDisplay');
const paddingVerticalInput = document.getElementById('paddingVertical');
const paddingHorizontalInput = document.getElementById('paddingHorizontal');
const customFontSizeInput = document.getElementById('customFontSize');
const applyFontSizeBtn = document.getElementById('applyFontSizeBtn');
// Preview
const textPreview = document.getElementById('textPreview');
const textPreviewContainer = document.getElementById('textPreviewContainer');

// Image Mode Elements
const imageUploadInput = document.getElementById('imageUpload');
const ditherMethodSelect = document.getElementById('ditherMethod');
const thresholdValueInput = document.getElementById('thresholdValue');
const thresholdDisplay = document.getElementById('thresholdDisplay');
const imageInvertInput = document.getElementById('imageInvert');
const imageWidthInput = document.getElementById('imageWidth');
const autoscaleImageInput = document.getElementById('autoscaleImage');
const imagePaddingInput = document.getElementById('imagePadding');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const rotationDisplay = document.getElementById('rotationDisplay');
const connectImageBtn = document.getElementById('connectImageBtn');
const resetImageBtn = document.getElementById('resetImageBtn');
const printImageBtn = document.getElementById('printImageBtn');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewMessage = document.getElementById('imagePreviewMessage');
const imageSummary = document.getElementById('imageSummary');

// Logger UI elements
const logWrapper = document.getElementById('logWrapper');
const clearLogBtn = document.getElementById('clearLogBtn');
const printProgressBar = document.getElementById('printProgressBar');

// === Data Store ===
let currentMode = 'text'; // 'text' or 'image'
let quill = null;

// === Battery Level Timer ===
let batteryCheckIntervalId = null;
const BATTERY_CHECK_INTERVAL = 30000; // 30 seconds

// === Initialize ===
function init() {
    
    // Initialize logger UI
    initLoggerUI();
    
    // Initialize mode toggle
    setupModeToggle();
    
    // Initialize Quill Editor
    initQuill();

    // Set up image mode listeners
    setupImageModeListeners();
    
    // Set up connect buttons
    setupConnectButtons();
    
    // Initialize print buttons (disabled by default)
    updatePrintButtonState();

    // Listeners for Text Mode Settings
    if (printDensityInput) {
        printDensityInput.addEventListener('input', () => {
            const val = parseInt(printDensityInput.value);
            printDensityDisplay.textContent = `${val} (0x${val.toString(16).toUpperCase().padStart(2, '0')})`;
        });
    }

    if (paddingVerticalInput) {
        paddingVerticalInput.addEventListener('input', schedulePreviewUpdate);
    }

    if (paddingHorizontalInput) {
        paddingHorizontalInput.addEventListener('input', schedulePreviewUpdate);
    }

    if (applyFontSizeBtn && customFontSizeInput) {
        applyFontSizeBtn.addEventListener('click', () => {
            if (!quill) return;
            const size = parseInt(customFontSizeInput.value);
            if (size > 0) {
                // Ensure editor has focus to get selection
                quill.focus();
                const range = quill.getSelection();
                if (range) {
                    if (range.length > 0) {
                        quill.format('size', `${size}px`);
                    } else {
                        // Insert text with this size or set format for next typing
                        quill.format('size', `${size}px`);
                    }
                }
            }
        });
    }

    // Initial preview update
    setTimeout(updateTextPreview, 500);
}

// Initialize Quill Editor
function initQuill() {
    // Import and register Size attributor
    const Size = Quill.import('attributors/style/size');

    // We explicitly clear the whitelist to allow arbitrary values
    Size.whitelist = null;

    // However, we need a list for the toolbar dropdown.
    const fontSizes = [
        '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px',
        '36px', '48px', '64px', '72px', '96px', '128px', '160px'
    ];

    Quill.register(Size, true);

    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'header': [1, 2, 3, false] }],
                [{ 'size': fontSizes }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['clean']
            ]
        },
        placeholder: 'Type your receipt text here...'
    });

    // Listen for changes to update preview
    quill.on('text-change', () => {
        // Debounce update
        if (window.previewTimeout) clearTimeout(window.previewTimeout);
        window.previewTimeout = setTimeout(updateTextPreview, 1000);
    });
}

// Initialize the logger UI
function initLoggerUI() {
    // Set up the logger UI
    setupLoggerUI(logWrapper, printProgressBar);
    
    // Add clear log button event listener
    clearLogBtn.addEventListener('click', () => {
        logger.clear();
        logger.info('Log cleared');
    });
}

// Setup mode toggle functionality
function setupModeToggle() {
    textModeBtn.addEventListener('click', () => {
        setActiveMode('text');
    });
    
    imageModeBtn.addEventListener('click', () => {
        setActiveMode('image');
    });
    
    // Initialize with text mode active
    setActiveMode('text');
}

// Set the active mode (text or image)
function setActiveMode(mode) {
    currentMode = mode;
    
    // Update button states
    textModeBtn.classList.toggle('active', mode === 'text');
    imageModeBtn.classList.toggle('active', mode === 'image');
    
    // Update ARIA states
    textModeBtn.setAttribute('aria-selected', mode === 'text');
    imageModeBtn.setAttribute('aria-selected', mode === 'image');

    // Update content visibility
    textModeContent.classList.toggle('active', mode === 'text');
    imageModeContent.classList.toggle('active', mode === 'image');
    
    // Update UI specific to the mode
    if (mode === 'text') {
        updateTextPreview();
    } else {
        updateImagePreview();
    }
    
    // Change printing status style based on mode
    document.documentElement.style.setProperty('--printing-status-color', 
        mode === 'text' ? '#3182ce' : '#c53030');
}

// Setup image mode event listeners
function setupImageModeListeners() {
    // Image upload
    imageUploadInput.addEventListener('change', handleImageUpload);
    
    // Drag and Drop functionality
    setupDragAndDrop();
    
    // Dither method change
    ditherMethodSelect.addEventListener('change', () => {
        imageProcessor.updateSettings({ ditherMethod: ditherMethodSelect.value });
        updateImagePreview();
    });
    
    // Threshold value change
    thresholdValueInput.addEventListener('input', () => {
        const threshold = parseInt(thresholdValueInput.value);
        thresholdDisplay.textContent = threshold;
        imageProcessor.updateSettings({ threshold });
        updateImagePreview();
    });
    
    // Invert toggle
    imageInvertInput.addEventListener('change', () => {
        imageProcessor.updateSettings({ invert: imageInvertInput.checked });
        updateImagePreview();
    });
    
    // Width change
    imageWidthInput.addEventListener('change', () => {
        let width = parseInt(imageWidthInput.value);
        if (width < 1) width = 1;
        if (width > 384) width = 384;
        imageWidthInput.value = width;
        imageProcessor.updateSettings({ width });
        updateImagePreview();
    });
    
    // Auto-scale toggle
    autoscaleImageInput.addEventListener('change', () => {
        imageProcessor.updateSettings({ autoscale: autoscaleImageInput.checked });
        updateImagePreview();
    });
    
    // Padding change
    imagePaddingInput.addEventListener('change', () => {
        let padding = parseInt(imagePaddingInput.value);
        if (padding < 0) padding = 0;
        if (padding > 100) padding = 100;
        imagePaddingInput.value = padding;
        imageProcessor.updateSettings({ padding });
        updateImagePreview();
    });
    
    // Rotate left button (counter-clockwise)
    rotateLeftBtn.addEventListener('click', () => {
        const settings = imageProcessor.getSettings();
        // Calculate new rotation (0, 90, 180, 270) with wrap-around
        let newRotation = (settings.rotation - 90) % 360;
        if (newRotation < 0) newRotation += 360;
        
        imageProcessor.updateSettings({ rotation: newRotation });
        rotationDisplay.textContent = `${newRotation}°`;
        logger.info(`Image rotated to ${newRotation}°`);
        updateImagePreview();
    });
    
    // Rotate right button (clockwise)
    rotateRightBtn.addEventListener('click', () => {
        const settings = imageProcessor.getSettings();
        // Calculate new rotation (0, 90, 180, 270) with wrap-around
        const newRotation = (settings.rotation + 90) % 360;
        
        imageProcessor.updateSettings({ rotation: newRotation });
        rotationDisplay.textContent = `${newRotation}°`;
        logger.info(`Image rotated to ${newRotation}°`);
        updateImagePreview();
    });
    
    // Reset image settings
    resetImageBtn.addEventListener('click', resetImageSettings);
    
    // Print image
    printImageBtn.addEventListener('click', printProcessedImage);
}

// === Drag and Drop Functionality ===
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    
    // Prevent the default behavior for these events to enable dropping
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Handle enter and over events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    // Handle leave and drop events
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Add and remove highlight class
    function highlight() {
        dropZone.classList.add('drag-over');
    }
    
    function unhighlight() {
        dropZone.classList.remove('drag-over');
    }
    
    // Handle the drop event
    dropZone.addEventListener('drop', handleDrop, false);

    // Make dropzone clickable and keyboard accessible
    dropZone.addEventListener('click', () => {
        imageUploadInput.click();
    });

    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            imageUploadInput.click();
        }
    });
    
    async function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files && files.length > 0) {
            const file = files[0];
            
            // Check if the file is an image
            if (!file.type.match('image.*')) {
                logger.warn('File is not an image');
                imagePreviewMessage.textContent = 'Error: Please upload an image file';
                return;
            }
            
            logger.info(`Processing dropped image: ${file.name}`, {
                type: file.type,
                size: `${Math.round(file.size / 1024)} KB`
            });
            
            // Show loading state
            imagePreviewMessage.textContent = 'Loading image...';
            imagePreview.style.display = 'none';
            
            try {
                // Load the image
                await imageProcessor.loadImage(file);
                
                // Update the preview
                updateImagePreview();
            } catch (err) {
                logger.error('Error processing dropped image', { message: err.message });
                imagePreviewMessage.textContent = `Error: ${err.message}`;
            }
        }
    }
}

// Handle image upload
async function handleImageUpload() {
    try {
        if (!imageUploadInput.files || !imageUploadInput.files[0]) {
            return;
        }
        
        const file = imageUploadInput.files[0];
        logger.info(`Processing uploaded image: ${file.name}`, {
            type: file.type,
            size: `${Math.round(file.size / 1024)} KB`
        });
        
        // Show loading state
        imagePreviewMessage.textContent = 'Loading image...';
        imagePreview.style.display = 'none';
        
        // Load the image
        await imageProcessor.loadImage(file);
        
        // Update the preview
        updateImagePreview();
        
    } catch (err) {
        logger.error('Error uploading image', { message: err.message });
        imagePreviewMessage.textContent = `Error: ${err.message}`;
    }
}

// Update the image preview
function updateImagePreview() {
    const canvas = imageProcessor.processImage();
    
    if (!canvas) {
        imagePreview.style.display = 'none';
        imagePreviewMessage.style.display = 'block';
        imagePreviewMessage.textContent = 'Drop image here or click the upload button';
        imageSummary.innerHTML = '';
        return;
    }
    
    // Display processed image
    imagePreview.width = canvas.width;
    imagePreview.height = canvas.height;
    const ctx = imagePreview.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(canvas, 0, 0);
    
    imagePreview.style.display = 'block';
    imagePreviewMessage.style.display = 'none';
    
    // Update image summary
    updateImageSummary();
}

// Update the image summary panel
function updateImageSummary() {
    const summary = imageProcessor.getImageSummary();
    if (!summary) {
        imageSummary.innerHTML = '';
        return;
    }
    
    // Only show threshold for dither methods that use it
    const usesThreshold = ['threshold', 'floydSteinberg', 'atkinson', 'halftone'].includes(summary.ditherMethod);
    const thresholdRow = usesThreshold ? `
        <div class="summary-row">
            <span>Threshold:</span> <span>${summary.threshold}</span>
        </div>` : '';
    
    imageSummary.innerHTML = `
    <div class="summary-section">
        <div class="summary-row">
            <span>Original Size:</span> <span>${summary.originalWidth} × ${summary.originalHeight} px</span>
        </div>
        <div class="summary-row">
            <span>Print Size:</span> <span>${summary.processedWidth} × ${summary.processedHeight} px</span>
        </div>
        <div class="summary-row">
            <span>Aspect Ratio:</span> <span>${summary.aspectRatio}</span>
        </div>
    </div>
    <div class="summary-section">
        <div class="summary-row">
            <span>Dithering:</span> <span>${summary.ditherMethod}</span>
        </div>${thresholdRow}
        <div class="summary-row">
            <span>Inverted:</span> <span>${summary.invert ? 'Yes' : 'No'}</span>
        </div>
        <div class="summary-row">
            <span>Rotation:</span> <span>${summary.rotation}°</span>
        </div>
    </div>`;
}

// Reset image settings
function resetImageSettings() {
    const settings = imageProcessor.resetSettings();
    
    // Update UI to match reset settings
    ditherMethodSelect.value = settings.ditherMethod;
    thresholdValueInput.value = settings.threshold;
    thresholdDisplay.textContent = settings.threshold;
    imageInvertInput.checked = settings.invert;
    imageWidthInput.value = settings.width;
    autoscaleImageInput.checked = settings.autoscale;
    imagePaddingInput.value = settings.padding;
    
    // Update preview
    updateImagePreview();
    logger.info('Image settings reset to defaults');
}

// Print the processed image
async function printProcessedImage() {
    const canvas = imageProcessor.processImage();
    
    if (!canvas) {
        logger.warn('No image to print');
        showPrintingStatus('No image to print', 'error');
        setTimeout(() => hidePrintingStatus(), 3000);
        return;
    }
    
    try {
        // Check if printer is connected
        if (!isPrinterConnected()) {
            logger.warn('Printer not connected');
            showPrintingStatus('Please connect to printer first', 'error');
            setTimeout(() => hidePrintingStatus(), 3000);
            return;
        }
        
        // Show printing status
        showPrintingStatus('Printing image...');
        
        // Log print job starting
        logger.info('Starting new print job');
        
        // Print the image
        await printImage(canvas);
        
        // Show success message
        showPrintingStatus('Image printed successfully!', 'success');
        setTimeout(() => hidePrintingStatus(), 3000);
    } catch (err) {
        console.error('Print error:', err);
        logger.error('Print error', { message: err.message });
        showPrintingStatus(`Error: ${err.message}`, 'error');
        setTimeout(() => hidePrintingStatus(), 5000);
    }
}

// === Connection and Battery Status ===
function setupConnectButtons() {
    // Add event listeners to both connect buttons
    connectTextBtn.addEventListener('click', handleConnectPrinter);
    connectImageBtn.addEventListener('click', handleConnectPrinter);
}

function updatePrintButtonState() {
    const connected = isPrinterConnected();
    
    // Update print buttons
    printTextBtn.disabled = !connected;
    printImageBtn.disabled = !connected;
    
    if (connected) {
        printTextBtn.classList.remove('btn-secondary');
        printTextBtn.classList.add('btn-primary');
        printImageBtn.classList.remove('btn-secondary');
        printImageBtn.classList.add('btn-primary');
    } else {
        printTextBtn.classList.remove('btn-primary');
        printTextBtn.classList.add('btn-secondary');
        printImageBtn.classList.remove('btn-primary');
        printImageBtn.classList.add('btn-secondary');
    }
    
    // Update connect buttons
    const buttonText = connected ? 'Reconnect' : 'Connect Printer';
    connectTextBtn.textContent = buttonText;
    connectImageBtn.textContent = buttonText;
    
    // Start or stop battery check based on connection status
    if (connected && !batteryCheckIntervalId) {
        startBatteryCheck();
    } else if (!connected && batteryCheckIntervalId) {
        stopBatteryCheck();
    }
}

async function handleConnectPrinter() {
    try {
        showPrintingStatus('Connecting to printer...');
        logger.info('Connecting to printer');
        await connectPrinter();
        
        // Update battery immediately after connection
        await updateBatteryStatus();
        
        // Start periodic battery check
        startBatteryCheck();
        
        // Update print button state
        updatePrintButtonState();
        
        showPrintingStatus('Printer connected successfully!', 'success');
        setTimeout(() => hidePrintingStatus(), 3000);
    } catch (err) {
        console.error('Connection error:', err);
        logger.error('Connection error', { message: err.message });
        showPrintingStatus(`Error: ${err.message}`, 'error');
        setTimeout(() => hidePrintingStatus(), 5000);
    }
}

function startBatteryCheck() {
    if (batteryCheckIntervalId) {
        clearInterval(batteryCheckIntervalId);
    }
    
    batteryCheckIntervalId = setInterval(async () => {
        if (isPrinterConnected()) {
            try {
                await updateBatteryStatus();
            } catch (error) {
                logger.warn('Failed to update battery status', { error: error.message });
            }
        } else {
            stopBatteryCheck();
        }
    }, BATTERY_CHECK_INTERVAL);
    
    logger.debug('Battery check interval started', { intervalMs: BATTERY_CHECK_INTERVAL });
}

function stopBatteryCheck() {
    if (batteryCheckIntervalId) {
        clearInterval(batteryCheckIntervalId);
        batteryCheckIntervalId = null;
        logger.debug('Battery check interval stopped');
    }
}

async function updateBatteryStatus() {
    try {
        let level;
        
        if (isPrinterConnected()) {
            // If connected, try to get fresh battery level
            level = await getBatteryLevel();
        } else {
            // If not connected, use last known level
            level = getLastKnownBatteryLevel();
        }
        
        if (level !== null) {
            updateBatteryIndicator(level);
        }
    } catch (error) {
        logger.warn('Error getting battery level', { message: error.message });
    }
}

function updateBatteryIndicator(level) {
    // Update the UI to display battery level
    if (level === null) {
        batteryIndicator.style.display = 'none';
        return;
    }
    
    batteryIndicator.style.display = 'flex';
    
    // Show percentage
    batteryLevel.textContent = `${level}%`;
    
    // Set color based on level
    if (level < 20) {
        batteryLevel.className = 'battery-level low';
        batteryIcon.innerHTML = '🔋';
    } else if (level < 50) {
        batteryLevel.className = 'battery-level medium';
        batteryIcon.innerHTML = '🔋';
    } else {
        batteryLevel.className = 'battery-level high';
        batteryIcon.innerHTML = '🔋';
    }
    
    logger.debug('Battery indicator updated', { level });
}

// === Text Preview Management ===

async function updateTextPreview() {
    try {
        const editorElement = document.getElementById('editor');
        if (!editorElement) return;
        
        const paddingVerticalMm = parseInt(paddingVerticalInput.value) || 0;
        const paddingHorizontalMm = parseInt(paddingHorizontalInput.value) || 0;

        const paddingVerticalPx = Math.round(paddingVerticalMm * 8);
        const paddingHorizontalPx = Math.round(paddingHorizontalMm * 8);

        const result = await renderTextToCanvas(editorElement, {
            paddingVertical: paddingVerticalPx,
            paddingHorizontal: paddingHorizontalPx
        });

        const canvas = result.canvas || result; // Handle both old and new return signature temporarily
        const warnings = result.warnings || [];
        
        // Clear current preview
        textPreview.innerHTML = '';
        
        // Handle warnings
        if (warnings.length > 0) {
            const warningEl = document.createElement('div');
            warningEl.style.backgroundColor = '#fed7d7';
            warningEl.style.color = '#c53030';
            warningEl.style.padding = '5px';
            warningEl.style.marginBottom = '5px';
            warningEl.style.fontSize = '0.8rem';
            warningEl.style.borderRadius = '3px';
            warningEl.innerHTML = warnings.join('<br>');
            textPreview.appendChild(warningEl);
        }

        // Set up canvas for display
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.display = 'block';
        
        // Border for the preview to see boundaries
        canvas.style.border = '1px dashed #ccc';

        textPreview.appendChild(canvas);
    } catch (err) {
        logger.warn("Failed to update text preview", {error: err.message});
    }
}

function resetEditor() {
    // Confirm before resetting
    if (confirm('Clear editor content?')) {
        if (quill) {
            quill.setContents([]);
        }
        updateTextPreview();
    }
}

// === Printing ===
async function printText() {
    try {
        // Check if printer is connected
        if (!isPrinterConnected()) {
            logger.warn('Printer not connected');
            showPrintingStatus('Please connect to printer first', 'error');
            setTimeout(() => hidePrintingStatus(), 3000);
            return;
        }
        
        // Show printing status
        showPrintingStatus('Printing text...');
        
        // Log print job starting
        logger.info('Starting new print job');
        
        // Get editor content and render to canvas
        const editorElement = document.getElementById('editor');
        const paddingVerticalMm = parseInt(paddingVerticalInput.value) || 0;
        const paddingHorizontalMm = parseInt(paddingHorizontalInput.value) || 0;

        const paddingVerticalPx = Math.round(paddingVerticalMm * 8);
        const paddingHorizontalPx = Math.round(paddingHorizontalMm * 8);

        const result = await renderTextToCanvas(editorElement, {
            paddingVertical: paddingVerticalPx,
            paddingHorizontal: paddingHorizontalPx
        });

        const canvas = result.canvas || result;
        
        logger.info('Text rendered', {
            width: canvas.width,
            height: canvas.height,
            paddingVerticalMm,
            paddingHorizontalMm
        });
        
        // Get intensity from slider
        const intensity = parseInt(printDensityInput.value) || 0x5D;

        // Print the image
        await printImage(canvas, { intensity });
        
        // Show success message
        showPrintingStatus('Text printed successfully!', 'success');
        setTimeout(() => hidePrintingStatus(), 3000);
    } catch (err) {
        console.error('Print error:', err);
        logger.error('Print error', { message: err.message });
        showPrintingStatus(`Error: ${err.message}`, 'error');
        setTimeout(() => hidePrintingStatus(), 5000);
    }
}

// === UI Feedback ===
function showPrintingStatus(message, type = 'info') {
    // Create status bar if it doesn't exist
    let statusBar = document.querySelector('.printing-status');
    
    if (!statusBar) {
        statusBar = document.createElement('div');
        statusBar.className = 'printing-status';
        document.body.appendChild(statusBar);
    }
    
    // Set color based on current mode and status type
    if (type === 'info') {
        statusBar.style.backgroundColor = currentMode === 'text' ? '#3182ce' : '#c53030';
    } else if (type === 'success') {
        statusBar.style.backgroundColor = '#2f855a';
    } else if (type === 'error') {
        statusBar.style.backgroundColor = '#c53030';
    }
    
    statusBar.textContent = message;
    statusBar.className = `printing-status ${type} active`;
}

function hidePrintingStatus() {
    const statusBar = document.querySelector('.printing-status');
    if (statusBar) {
        statusBar.classList.remove('active');
    }
}

// === Event Listeners ===
printTextBtn.addEventListener('click', printText);
resetBtn.addEventListener('click', resetEditor);

// Initialize the app
init();