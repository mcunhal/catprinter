import { BaseBlock } from './BaseBlock.js';
import { renderTextToCanvas } from '../textRenderer.js';

export class TextBlock extends BaseBlock {
    constructor(manager) {
        super(manager, 'text');

        // Editor container
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'text-block-editor';
        // Unique ID for Quill
        this.editorContainer.id = `editor-${this.id}`;

        this.content.appendChild(this.editorContainer);

        // Initialize Quill after a brief delay to ensure DOM insertion (or handle it in render)
        // Actually, Quill needs the element to be in DOM or at least created.
        setTimeout(() => this.initQuill(), 0);
    }

    initQuill() {
        // Register Size attributor if not already (it's global, so maybe check)
        // We assume main.js or similar did the global registry or we do it safely here.
        const Size = Quill.import('attributors/style/size');
        if (Size.whitelist !== null) {
             Size.whitelist = null;
             Quill.register(Size, true);
        }

        this.quill = new Quill(this.editorContainer, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'align': [] }],
                    [{ 'header': [1, 2, false] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'size': ['10px', '12px', '14px', '16px', '18px', '24px', '32px'] }],
                    ['clean']
                ]
            },
            placeholder: 'Type something...'
        });

        // UX: Auto-focus if it's a new block? Maybe.

        // Add Custom Font Size Input
        this._addCustomFontSizeInput();
    }

    _addCustomFontSizeInput() {
        const toolbar = this.quill.getModule('toolbar');
        const sizePicker = toolbar.container.querySelector('.ql-size');

        if (sizePicker) {
            // Create Input
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'ql-custom-size';
            input.placeholder = 'px';
            input.min = 8;
            input.max = 200;
            input.title = 'Custom Font Size';

            // Style it to fit in toolbar
            input.style.width = '40px';
            input.style.marginLeft = '4px';
            input.style.padding = '2px';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '3px';
            input.style.fontSize = '12px';

            // Handle Change
            input.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if (val > 0) {
                    this.quill.format('size', `${val}px`);
                }
            });

            // Handle Selection Change to update input
            this.quill.on('selection-change', (range) => {
                if (range) {
                    const format = this.quill.getFormat(range);
                    if (format.size && format.size.endsWith('px')) {
                        input.value = parseInt(format.size);
                    } else {
                        input.value = '';
                    }
                }
            });

            // Insert after the picker
            sizePicker.parentNode.insertBefore(input, sizePicker.nextSibling);
        }
    }

    onPreviewMode(active) {
        if (!this.quill) return;
        if (active) {
            this.quill.disable();
        } else {
            this.quill.enable();
        }
    }

    async renderCanvas() {
        // Use the existing renderer
        // We need to pass the editor element. Quill creates a .ql-editor div inside our container.
        const result = await renderTextToCanvas(this.editorContainer, {
            paddingVertical: 0, // Blocks have their own padding usually, but renderer handles it inside canvas
            paddingHorizontal: 0
        });
        return result.canvas || result;
    }
}
