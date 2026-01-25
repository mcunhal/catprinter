import { connectPrinter, disconnectPrinter, isPrinterConnected, getBatteryLevel, getLastKnownBatteryLevel } from './printer.js';
import { logger, setupLoggerUI } from './logger.js';
import { BlockManager } from './BlockManager.js';
import { TextBlock } from './blocks/TextBlock.js';
import { ImageBlock } from './blocks/ImageBlock.js';
import { QRBlock } from './blocks/QRBlock.js';

// === State ===
let batteryCheckInterval = null;

// === DOM Elements ===
const blocksContainer = document.getElementById('blocksContainer');
const emptyState = document.getElementById('emptyState');

// Controls
const addTextBtn = document.getElementById('addTextBtn');
const addImageBtn = document.getElementById('addImageBtn');
const addQRBtn = document.getElementById('addQRBtn');

const connectBtn = document.getElementById('connectBtn');
const printBtn = document.getElementById('printBtn');

const settingsBtn = document.getElementById('settingsBtn');
const settingsPopover = document.getElementById('settingsPopover');

const printDensityInput = document.getElementById('printDensity');
const printDensityDisplay = document.getElementById('printDensityDisplay');
const paddingVerticalInput = document.getElementById('paddingVertical');
const paddingHorizontalInput = document.getElementById('paddingHorizontal');
const clearLogBtn = document.getElementById('clearLogBtn');
const showLogBtn = document.getElementById('showLogBtn');

const logDrawer = document.getElementById('logDrawer');
const logBackdrop = document.getElementById('logBackdrop');
const closeLogBtn = document.getElementById('closeLogBtn');
const logWrapper = document.getElementById('logWrapper');
const printProgressBar = document.getElementById('printProgressBar');

const batteryIndicator = document.getElementById('batteryIndicator');
const batteryLevel = document.getElementById('batteryLevel');

// === Initialization ===
setupLoggerUI(logWrapper, printProgressBar);
const manager = new BlockManager(blocksContainer);

// === Event Listeners ===

// Add Block Handlers
addTextBtn.addEventListener('click', () => addBlock('text'));
addImageBtn.addEventListener('click', () => addBlock('image'));
addQRBtn.addEventListener('click', () => addBlock('qr'));

function addBlock(type) {
    let block;
    switch (type) {
        case 'text':
            block = new TextBlock(manager);
            break;
        case 'image':
            block = new ImageBlock(manager);
            break;
        case 'qr':
            block = new QRBlock(manager);
            break;
    }
    
    if (block) {
        manager.addBlock(block);
        updateEmptyState();
    }
}

// Intercept removal to update empty state
// We monkey-patch or just check periodically?
// Better: Add a callback or observer to BlockManager?
// For now, let's use MutationObserver on blocksContainer to detect changes.
const observer = new MutationObserver(() => {
    updateEmptyState();
});
observer.observe(blocksContainer, { childList: true });

function updateEmptyState() {
    if (manager.getBlockCount() === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
    }
}

// Printer Connection
connectBtn.addEventListener('click', async () => {
    if (isPrinterConnected()) {
        await disconnectPrinter();
        connectBtn.textContent = 'Connect';
        connectBtn.classList.remove('btn-secondary');
        connectBtn.classList.add('btn-primary');
        printBtn.disabled = true;
        batteryIndicator.style.display = 'none';
        if (batteryCheckInterval) clearInterval(batteryCheckInterval);
        return;
    }

    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';
        
        await connectPrinter();
        
        connectBtn.textContent = 'Disconnect';
        connectBtn.classList.remove('btn-primary');
        connectBtn.classList.add('btn-secondary');

        printBtn.disabled = false;
        
        startBatteryCheck();
        updateBatteryUI();
        
    } catch (err) {
        console.error(err);
        alert('Connection failed: ' + err.message);
        connectBtn.textContent = 'Connect';
        connectBtn.classList.remove('btn-secondary');
        connectBtn.classList.add('btn-primary');
    } finally {
        connectBtn.disabled = false;
    }
});

// Print
printBtn.addEventListener('click', async () => {
    if (!isPrinterConnected()) {
        alert('Printer not connected');
        return;
    }
    
    try {
        printBtn.disabled = true;
        printBtn.textContent = 'Printing...';
        
        const intensity = parseInt(printDensityInput.value);
        const paddingVertical = parseInt(paddingVerticalInput.value) || 0;
        const paddingHorizontal = parseInt(paddingHorizontalInput.value) || 0;

        // Convert mm to pixels? Driver doesn't handle padding inside printImage usually.
        // Wait, TextRenderer did. But manager loops blocks.
        // We will pass these options to manager, and manager passes to blocks.
        await manager.printAll({
            intensity,
            paddingVertical,
            paddingHorizontal
        });
        
    } catch (err) {
        console.error(err);
        alert('Print failed: ' + err.message);
    } finally {
        printBtn.disabled = false;
        printBtn.textContent = 'Print';
    }
});

// Settings Toggle
settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent closing immediately
    settingsPopover.classList.toggle('active');
});

// Close settings when clicking outside
document.addEventListener('click', (e) => {
    if (!settingsPopover.contains(e.target) && e.target !== settingsBtn) {
        settingsPopover.classList.remove('active');
    }
});

// Density Input
printDensityInput.addEventListener('input', (e) => {
    printDensityDisplay.textContent = e.target.value;
});

// Log UI
clearLogBtn.addEventListener('click', () => {
    logger.clear();
});

showLogBtn.addEventListener('click', () => {
    logDrawer.classList.add('open');
    logBackdrop.classList.add('open');
    settingsPopover.classList.remove('active'); // Close settings
});

function closeLog() {
    logDrawer.classList.remove('open');
    logBackdrop.classList.remove('open');
}

closeLogBtn.addEventListener('click', closeLog);
logBackdrop.addEventListener('click', closeLog);

// Battery Logic
function startBatteryCheck() {
    if (batteryCheckInterval) clearInterval(batteryCheckInterval);
    batteryCheckInterval = setInterval(updateBatteryUI, 60000); // Check every minute
}

async function updateBatteryUI() {
    if (!isPrinterConnected()) return;
    
    try {
        const level = await getBatteryLevel(); // Or getLastKnownBatteryLevel
        if (level !== null) {
            batteryIndicator.style.display = 'flex';
            batteryLevel.textContent = level + '%';

            // Color logic
            if (level < 20) batteryLevel.style.color = 'var(--color-danger)';
            else if (level > 50) batteryLevel.style.color = 'var(--color-success, green)'; // Need var
            else batteryLevel.style.color = 'var(--color-text)';
        }
    } catch (e) {
        console.warn('Battery check failed', e);
    }
}

// Initial check
updateEmptyState();
