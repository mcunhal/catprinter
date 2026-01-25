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
