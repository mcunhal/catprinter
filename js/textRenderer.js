import { PRINTER_WIDTH } from './printer.js';

/**
 * Renders the content of the Quill editor to a canvas using html2canvas.
 * @param {HTMLElement} editorElement - The Quill editor's root element (the one containing the content).
 * @returns {Promise<HTMLCanvasElement>} The generated canvas.
 */
export async function renderTextToCanvas(editorElement) {
    if (!editorElement) {
        throw new Error("Editor element not found");
    }

    // We need to ensure the element we capture is styled exactly like the printer output (384px wide).
    // We'll clone the content to a temporary off-screen container to render it.
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = `${PRINTER_WIDTH}px`;
    tempContainer.style.backgroundColor = 'white';
    tempContainer.style.color = 'black';
    tempContainer.style.fontFamily = 'sans-serif'; // Or specific font if needed

    // Copy the inner HTML of the editor
    // Quill uses .ql-editor which has the content
    const qlEditor = editorElement.querySelector('.ql-editor') || editorElement;
    tempContainer.innerHTML = qlEditor.innerHTML;

    // Append to body to render
    document.body.appendChild(tempContainer);

    try {
        // Use html2canvas to render
        // We assume html2canvas is loaded globally via CDN in index.html
        if (typeof window.html2canvas === 'undefined') {
            throw new Error("html2canvas not loaded");
        }

        const canvas = await window.html2canvas(tempContainer, {
            width: PRINTER_WIDTH,
            scale: 1, // 1:1 scale for pixel perfection
            backgroundColor: '#ffffff',
            logging: false
        });

        return canvas;
    } finally {
        // Cleanup
        document.body.removeChild(tempContainer);
    }
}
