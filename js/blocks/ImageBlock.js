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
        this.settingsPanel.style.display = 'none';

        this._buildSettingsUI();
        this._setupEvents();

        this.content.appendChild(this.dropZone);
        this.content.appendChild(this.fileInput);
        this.content.appendChild(this.previewCanvas);
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

        this.settingsPanel.appendChild(ditherGroup);
        this.settingsPanel.appendChild(threshGroup);
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
            this.settingsPanel.style.display = 'flex';
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

    async renderCanvas() {
        return this.processor.processImage();
    }
}
