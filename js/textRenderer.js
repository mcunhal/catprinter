import { PRINTER_WIDTH } from './printer.js';

/**
 * Renders the content of the Quill editor to a canvas using html2canvas.
 * @param {HTMLElement} editorElement - The Quill editor's root element (the one containing the content).
 * @param {Object} options - Rendering options.
 * @param {number} options.paddingVertical - Vertical padding in pixels.
 * @param {number} options.paddingHorizontal - Horizontal padding in pixels.
 * @returns {Promise<{canvas: HTMLCanvasElement, warnings: string[]}>} The generated canvas and any warnings.
 */
export async function renderTextToCanvas(editorElement, options = {}) {
    if (!editorElement) {
        throw new Error("Editor element not found");
    }

    const paddingVertical = options.paddingVertical || 0;
    const paddingHorizontal = options.paddingHorizontal || 0;
    const warnings = [];

    // Calculate usable width for content
    const usableWidth = PRINTER_WIDTH - (paddingHorizontal * 2);

    // Create temporary off-screen container
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '-9999px';
    // White background (looks like paper)
    tempContainer.style.backgroundColor = 'white';
    tempContainer.style.color = 'black';
    tempContainer.style.fontFamily = 'sans-serif';

    // Add ql-editor class for Quill styles
    tempContainer.className = 'ql-editor';

    // Portrait Mode (Default)
    // Standard width constraint
    tempContainer.style.width = `${usableWidth}px`;
    tempContainer.style.height = 'auto';
    tempContainer.style.whiteSpace = 'normal'; // Standard wrapping
    tempContainer.style.overflow = 'visible';

    // Copy content
    const qlEditor = editorElement.querySelector('.ql-editor') || editorElement;
    tempContainer.innerHTML = qlEditor.innerHTML;

    // Append to body to measure and render
    document.body.appendChild(tempContainer);

    try {
        if (typeof window.html2canvas === 'undefined') {
            throw new Error("html2canvas not loaded");
        }

        // Measure content dimensions
        const rect = tempContainer.getBoundingClientRect();
        const contentWidth = rect.width;
        const contentHeight = rect.height;

        // Render the content to a temporary canvas
        const sourceCanvas = await window.html2canvas(tempContainer, {
            backgroundColor: '#ffffff', // White background
            scale: 1,
            logging: false,
            width: contentWidth,
            height: contentHeight,
            windowWidth: Math.max(contentWidth, PRINTER_WIDTH) // ensure context is wide enough
        });

        // Create final canvas
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');

        // PORTRAIT MODE

        finalCanvas.width = PRINTER_WIDTH;
        finalCanvas.height = contentHeight + (paddingVertical * 2);

        // Fill background with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // Draw centered horizontally
        // paddingHorizontal is the gap on left.
        // We rendered source at usableWidth.
        ctx.drawImage(sourceCanvas, paddingHorizontal, paddingVertical);

        return { canvas: finalCanvas, warnings };

    } finally {
        document.body.removeChild(tempContainer);
    }
}
