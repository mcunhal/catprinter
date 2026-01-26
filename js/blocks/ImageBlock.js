import { BaseBlock } from './BaseBlock.js';
import { ImageProcessor } from '../imageProcessor.js';

export class ImageBlock extends BaseBlock {
    constructor(manager) {
        super(manager, 'image');
        this.processor = new ImageProcessor();

        // UI Structure
        this.dropZone = document.createElement('div');
        this.dropZone.className = 'image-drop-zone';
        this.dropZone.innerHTML = '<span>📷 Drop image or Click</span>';

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';

        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.className = 'image-preview-canvas';
        this.previewCanvas.style.display = 'none';

        // Controls
        this.settingsPanel = document.createElement('div');
        this.settingsPanel.className = 'image-settings-panel';
        this.settingsPanel.style.display = 'none'; // Initially hidden

        // Settings Toggle Button (Shown when image is loaded)
        this.settingsToggleBtn = document.createElement('button');
        this.settingsToggleBtn.innerHTML = '⚙️ Settings';
        this.settingsToggleBtn.className = 'btn-settings-toggle';
        this.settingsToggleBtn.style.display = 'none';
        this.settingsToggleBtn.onclick = () => {
            const isHidden = this.settingsPanel.style.display === 'none';
            this.settingsPanel.style.display = isHidden ? 'flex' : 'none';
        };

        this._buildSettingsUI();
        this._setupEvents();

        this.content.appendChild(this.dropZone);
        this.content.appendChild(this.fileInput);
        this.content.appendChild(this.previewCanvas);
        this.content.appendChild(this.settingsToggleBtn);
        this.content.appendChild(this.settingsPanel);
    }

    _buildSettingsUI() {
        // Dither Select
        const ditherGroup = document.createElement('div');
        ditherGroup.className = 'setting-group';
        const ditherSel = document.createElement('select');
        ['floydSteinberg', 'atkinson', 'threshold', 'halftone', 'none'].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.text = m;
            ditherSel.appendChild(opt);
        });
        ditherSel.value = 'floydSteinberg'; // Default
        ditherSel.onchange = (e) => this.updateSettings({ ditherMethod: e.target.value });
        ditherGroup.appendChild(ditherSel);

        // Threshold Slider
        const threshGroup = document.createElement('div');
        threshGroup.className = 'setting-group';
        const threshInput = document.createElement('input');
        threshInput.type = 'range';
        threshInput.min = 0;
        threshInput.max = 255;
        threshInput.value = 128;
        threshInput.oninput = (e) => this.updateSettings({ threshold: parseInt(e.target.value) });
        threshGroup.appendChild(threshInput);

        // Rotate Button
        const rotateBtn = document.createElement('button');
        rotateBtn.innerText = '↻';
        rotateBtn.className = 'control-btn';
        rotateBtn.title = 'Rotate 90°';
        rotateBtn.onclick = () => {
            const current = this.processor.getSettings().rotation || 0;
            this.updateSettings({ rotation: (current + 90) % 360 });
        };

        // Invert Checkbox
        const invertGroup = document.createElement('div');
        invertGroup.className = 'setting-group';
        const invertCb = document.createElement('input');
        invertCb.type = 'checkbox';
        invertCb.id = `inv-${this.id}`;
        invertCb.onchange = (e) => this.updateSettings({ invert: e.target.checked });
        const invertLabel = document.createElement('label');
        invertLabel.htmlFor = invertCb.id;
        invertLabel.innerText = 'Invert';
        invertGroup.appendChild(invertCb);
        invertGroup.appendChild(invertLabel);

        // AutoScale Checkbox
        const autoGroup = document.createElement('div');
        autoGroup.className = 'setting-group';
        const autoCb = document.createElement('input');
        autoCb.type = 'checkbox';
        autoCb.id = `auto-${this.id}`;
        autoCb.checked = true;
        autoCb.onchange = (e) => this.updateSettings({ autoscale: e.target.checked });
        const autoLabel = document.createElement('label');
        autoLabel.htmlFor = autoCb.id;
        autoLabel.innerText = 'Fit';
        autoGroup.appendChild(autoCb);
        autoGroup.appendChild(autoLabel);

        this.settingsPanel.appendChild(ditherGroup);
        this.settingsPanel.appendChild(threshGroup);
        this.settingsPanel.appendChild(invertGroup);
        this.settingsPanel.appendChild(autoGroup);
        this.settingsPanel.appendChild(rotateBtn);
    }

    _setupEvents() {
        this.dropZone.onclick = () => this.fileInput.click();

        this.fileInput.onchange = (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadImage(e.target.files[0]);
            }
        };

        this.dropZone.ondragover = (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        };

        this.dropZone.ondragleave = () => {
            this.dropZone.classList.remove('drag-over');
        };

        this.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.loadImage(e.dataTransfer.files[0]);
            }
        };
    }

    async loadImage(file) {
        try {
            await this.processor.loadImage(file);
            this.refreshPreview();

            // UI State Change
            this.dropZone.style.display = 'none';
            this.previewCanvas.style.display = 'block';
            this.settingsToggleBtn.style.display = 'block';
            // Don't auto-open settings, keep it clean
            this.settingsPanel.style.display = 'none';
        } catch (e) {
            console.error(e);
            this.dropZone.innerText = 'Error loading image';
        }
    }

    updateSettings(settings) {
        this.processor.updateSettings(settings);
        this.refreshPreview();
    }

    refreshPreview() {
        const processed = this.processor.processImage();
        if (processed) {
            this.previewCanvas.width = processed.width;
            this.previewCanvas.height = processed.height;
            const ctx = this.previewCanvas.getContext('2d');
            ctx.drawImage(processed, 0, 0);
        }
    }

    async renderCanvas(options = {}) {
        // Calculate effective width and padding
        const paddingVertical = (options.paddingVertical || 0) * 8; // mm to px
        const paddingHorizontal = (options.paddingHorizontal || 0) * 8;

        // Effective width is printer width minus horizontal padding
        // 384 is PRINTER_WIDTH constant
        const effectiveWidth = 384 - (paddingHorizontal * 2);

        // Save current settings
        const originalSettings = this.processor.getSettings();

        // Update processor settings temporarily
        // We override width.
        // We also want to ensure the processor uses the vertical padding
        // ImageProcessor has 'padding' setting which adds spacing around.
        // However, ImageProcessor calculates canvas size based on width and padding.
        // If we set width=effectiveWidth, and padding=paddingVertical,
        // it will draw a canvas of width `effectiveWidth`?
        // Wait, ImageProcessor:
        // if (isRotated...) canvas.width = destWidth; canvas.height = destHeight + (padding * 2);
        // If destWidth is effectiveWidth, the canvas will be narrower than 384.
        // The Printer Driver expects 384 width usually?
        // printImage in printer.js:
        // `if (width !== PRINTER_WIDTH) { throw ... }` inside processImageTo1bpp.
        // BUT processImageTo1bpp is for RAW canvas.
        // BlockManager passes canvas to `printImage`.
        // `printImage` calls `processImageTo1bpp`.
        // So the canvas MUST be 384px wide.

        // If ImageProcessor produces a narrower canvas, printImage will FAIL.
        // FIX: ImageProcessor should produce 384px canvas, but content should be constrained.

        // ImageProcessor logic (from memory/read):
        // `destWidth = settings.width`
        // `canvas.width = destWidth` (if not rotated).

        // So we can't just change width to effectiveWidth if ImageProcessor doesn't support a "canvas width" vs "content width".
        // Let's wrap the result.

        // 1. Generate the image content with constrained width.
        this.processor.updateSettings({
            width: effectiveWidth,
            // We don't use processor padding here, we'll wrap it ourselves to ensure 384 width
            padding: 0
        });

        const contentCanvas = this.processor.processImage();

        // Restore settings
        this.processor.updateSettings(originalSettings);

        if (!contentCanvas) return null;

        // 2. Create a final 384px canvas with padding
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 384;
        finalCanvas.height = contentCanvas.height + (paddingVertical * 2);

        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Draw centered (or using horizontal padding)
        // x = paddingHorizontal
        // y = paddingVertical
        ctx.drawImage(contentCanvas, paddingHorizontal, paddingVertical);

        return finalCanvas;
    }
}
