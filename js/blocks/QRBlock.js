import { BaseBlock } from './BaseBlock.js';

export class QRBlock extends BaseBlock {
    constructor(manager) {
        super(manager, 'qr');

        // State
        this.format = 'url';
        this.data = { url: "https://example.com" };

        // UI
        this.inputContainer = document.createElement('div');
        this.inputContainer.className = 'qr-input-container';

        // Format selector
        this.formatSelect = document.createElement('select');
        this.formatSelect.className = 'qr-format-select';

        const formats = [
            { value: 'url', label: 'URL' },
            { value: 'text', label: 'Text' },
            { value: 'vcard', label: 'vCard (Contact)' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'wifi', label: 'WiFi' },
            { value: 'email', label: 'Email' },
            { value: 'sms', label: 'SMS' }
        ];

        formats.forEach(f => {
            const option = document.createElement('option');
            option.value = f.value;
            option.textContent = f.label;
            this.formatSelect.appendChild(option);
        });

        // Container for dynamic fields
        this.fieldsContainer = document.createElement('div');
        this.fieldsContainer.className = 'qr-fields-container';

        this.qrContainer = document.createElement('div');
        this.qrContainer.className = 'qr-preview';

        // Debounce generation
        this.timeout = null;

        // Listeners
        this.formatSelect.addEventListener('change', (e) => {
            this.format = e.target.value;
            this.data = {}; // Reset data on format change
            this.renderFields();
            this.generateQR();
        });

        this.inputContainer.appendChild(this.formatSelect);
        this.inputContainer.appendChild(this.fieldsContainer);

        this.content.appendChild(this.inputContainer);
        this.content.appendChild(this.qrContainer);

        this.renderFields();
        setTimeout(() => this.generateQR(), 100);
    }

    triggerUpdate() {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.generateQR(), 300);
    }

    createInput(key, placeholder, type = 'text') {
        const input = document.createElement('input');
        input.type = type;
        input.placeholder = placeholder;
        input.className = 'qr-input';
        input.value = this.data[key] || '';
        input.addEventListener('input', (e) => {
            this.data[key] = e.target.value;
            this.triggerUpdate();
        });
        return input;
    }

    createTextarea(key, placeholder) {
        const textarea = document.createElement('textarea');
        textarea.placeholder = placeholder;
        textarea.className = 'qr-input qr-textarea';
        textarea.value = this.data[key] || '';
        textarea.addEventListener('input', (e) => {
            this.data[key] = e.target.value;
            this.triggerUpdate();
        });
        return textarea;
    }

    createSelect(key, options) {
        const select = document.createElement('select');
        select.className = 'qr-input qr-select';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
        select.value = this.data[key] || options[0].value;
        if (!this.data[key]) {
             this.data[key] = select.value;
        }
        select.addEventListener('change', (e) => {
            this.data[key] = e.target.value;
            this.triggerUpdate();
        });
        return select;
    }

    renderFields() {
        this.fieldsContainer.innerHTML = '';

        switch (this.format) {
            case 'url':
                this.fieldsContainer.appendChild(this.createInput('url', 'Enter URL (e.g., https://example.com)'));
                break;
            case 'text':
                this.fieldsContainer.appendChild(this.createTextarea('text', 'Enter text...'));
                break;
            case 'vcard':
                this.fieldsContainer.appendChild(this.createInput('firstName', 'First Name'));
                this.fieldsContainer.appendChild(this.createInput('lastName', 'Last Name'));
                this.fieldsContainer.appendChild(this.createInput('phone', 'Phone Number', 'tel'));
                this.fieldsContainer.appendChild(this.createInput('email', 'Email Address', 'email'));
                this.fieldsContainer.appendChild(this.createTextarea('conditions', 'Medical Conditions'));
                this.fieldsContainer.appendChild(this.createTextarea('medications', 'Medications'));
                this.fieldsContainer.appendChild(this.createInput('bloodType', 'Blood Type'));
                this.fieldsContainer.appendChild(this.createTextarea('notes', 'Additional Notes'));
                break;
            case 'whatsapp':
                this.fieldsContainer.appendChild(this.createInput('phone', 'Phone Number (with country code)', 'tel'));
                this.fieldsContainer.appendChild(this.createTextarea('message', 'Message (optional)'));
                break;
            case 'wifi':
                this.fieldsContainer.appendChild(this.createInput('ssid', 'Network Name (SSID)'));
                this.fieldsContainer.appendChild(this.createInput('password', 'Password'));
                this.fieldsContainer.appendChild(this.createSelect('encryption', [
                    { value: 'WPA', label: 'WPA/WPA2' },
                    { value: 'WEP', label: 'WEP' },
                    { value: 'nopass', label: 'None' }
                ]));
                break;
            case 'email':
                this.fieldsContainer.appendChild(this.createInput('email', 'Email Address', 'email'));
                this.fieldsContainer.appendChild(this.createInput('subject', 'Subject'));
                this.fieldsContainer.appendChild(this.createTextarea('body', 'Body'));
                break;
            case 'sms':
                this.fieldsContainer.appendChild(this.createInput('phone', 'Phone Number', 'tel'));
                this.fieldsContainer.appendChild(this.createTextarea('message', 'Message'));
                break;
        }
    }

    getPayload() {
        switch (this.format) {
            case 'url':
                return this.data.url || '';
            case 'text':
                return this.data.text || '';
            case 'vcard':
                if (!this.data.firstName && !this.data.lastName) return '';
                let vcard = `BEGIN:VCARD\nVERSION:3.0\n`;
                vcard += `N:${this.data.lastName || ''};${this.data.firstName || ''};;;\n`;
                vcard += `FN:${this.data.firstName || ''} ${this.data.lastName || ''}\n`;
                if (this.data.phone) vcard += `TEL;TYPE=CELL:${this.data.phone}\n`;
                if (this.data.email) vcard += `EMAIL:${this.data.email}\n`;

                let combinedNotes = [];
                if (this.data.conditions) combinedNotes.push(`Conditions: ${this.data.conditions}`);
                if (this.data.medications) combinedNotes.push(`Medications: ${this.data.medications}`);
                if (this.data.bloodType) combinedNotes.push(`Blood Type: ${this.data.bloodType}`);
                if (this.data.notes) combinedNotes.push(`Notes: ${this.data.notes}`);

                if (combinedNotes.length > 0) {
                    const noteStr = combinedNotes.join('\n').replace(/\n/g, '\\n');
                    vcard += `NOTE:${noteStr}\n`;
                }

                vcard += `END:VCARD`;
                return vcard;
            case 'whatsapp':
                if (!this.data.phone) return '';
                let waUrl = `https://wa.me/${this.data.phone.replace(/[^0-9]/g, '')}`;
                if (this.data.message) {
                    waUrl += `?text=${encodeURIComponent(this.data.message)}`;
                }
                return waUrl;
            case 'wifi':
                if (!this.data.ssid) return '';
                const type = this.data.encryption || 'WPA';
                const hidden = false; // Add support if needed
                let wifi = `WIFI:T:${type};S:${this.data.ssid};`;
                if (type !== 'nopass' && this.data.password) {
                    wifi += `P:${this.data.password};`;
                }
                wifi += `H:${hidden ? 'true' : 'false'};;`;
                return wifi;
            case 'email':
                if (!this.data.email) return '';
                let mailto = `mailto:${this.data.email}`;
                const params = [];
                if (this.data.subject) params.push(`subject=${encodeURIComponent(this.data.subject)}`);
                if (this.data.body) params.push(`body=${encodeURIComponent(this.data.body)}`);
                if (params.length > 0) mailto += `?${params.join('&')}`;
                return mailto;
            case 'sms':
                if (!this.data.phone) return '';
                let smsto = `smsto:${this.data.phone}`;
                if (this.data.message) {
                    smsto += `:${this.data.message}`;
                }
                return smsto;
            default:
                return '';
        }
    }

    generateQR() {
        const text = this.getPayload();
        this.qrContainer.innerHTML = ''; // Clear previous

        if (!text) return;

        if (typeof QRCode === 'undefined') {
            this.qrContainer.innerText = 'Error: QRCode library missing';
            return;
        }

        try {
            // Generate QR Code
            // We use a fixed size for the preview.
            new QRCode(this.qrContainer, {
                text: text,
                width: 200,
                height: 200,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } catch (e) {
            console.error(e);
        }
    }

    onPreviewMode(active) {
        if (active) {
            this.inputContainer.style.display = 'none';
        } else {
            this.inputContainer.style.display = 'block';
        }
    }

    async renderCanvas(options = {}) {
        const text = this.getPayload();
        if (!text) return null;

        const paddingVertical = (options.paddingVertical || 0) * 8;
        // QR Block ignores horizontal padding for scaling (it's fixed 200px),
        // but acts as "margins" if we want strictly correct paper layout.
        // For now, let's keep it centered but add vertical padding.

        const qrSize = 200;
        const canvasHeight = qrSize + (paddingVertical * 2);

        const canvas = document.createElement('canvas');
        canvas.width = 384;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 384, canvasHeight);

        // Grab the canvas generated by QRCode lib
        const srcCanvas = this.qrContainer.querySelector('canvas');
        const srcImg = this.qrContainer.querySelector('img');

        // Prefer canvas, fallback to img
        const source = srcCanvas || srcImg;

        if (source) {
            // Center horizontally: (384 - 200) / 2 = 92
            const x = (384 - qrSize) / 2;
            // Center vertically with padding: paddingVertical
            const y = paddingVertical;
            ctx.drawImage(source, x, y, qrSize, qrSize);
        } else {
            // Fallback: render error text
            ctx.fillStyle = 'black';
            ctx.font = '20px sans-serif';
            ctx.fillText('QR Code Error', 10, 50);
        }

        return canvas;
    }
}
