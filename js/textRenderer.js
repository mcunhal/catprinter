import { PRINTER_WIDTH } from './printer.js';

/**
 * Renders the content of the Quill editor to a canvas using html2canvas.
 * @param {HTMLElement} editorElement - The Quill editor's root element (the one containing the content).
 * @param {Object} options - Rendering options.
 * @param {number} options.paddingVertical - Vertical padding in pixels.
 * @param {number} options.paddingHorizontal - Horizontal padding in pixels.
 * @param {string} options.orientation - 'portrait' or 'landscape'.
 * @returns {Promise<{canvas: HTMLCanvasElement, warnings: string[]}>} The generated canvas and any warnings.
 */
export async function renderTextToCanvas(editorElement, options = {}) {
    if (!editorElement) {
        throw new Error("Editor element not found");
    }

    const orientation = options.orientation || 'portrait';
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
    tempContainer.style.backgroundColor = 'white';
    tempContainer.style.color = 'black';
    tempContainer.style.fontFamily = 'sans-serif';

    // Add ql-editor class for Quill styles
    tempContainer.className = 'ql-editor';

    // Layout Logic based on Orientation
    if (orientation === 'landscape') {
        // Banner Mode (Landscape)
        // Content flows horizontally (visual) which is vertical on paper
        // So we don't constrain width, but we must check if height exceeds usableWidth
        tempContainer.style.width = 'fit-content'; // Allow growing wide but fit content
        tempContainer.style.height = 'auto';
        tempContainer.style.whiteSpace = 'pre'; // Disable wrapping, respect newlines
        tempContainer.style.display = 'inline-block'; // Ensure it wraps content tightly
        tempContainer.style.minWidth = 'auto';
    } else {
        // Portrait Mode
        // Standard width constraint
        tempContainer.style.width = `${usableWidth}px`;
        tempContainer.style.height = 'auto';
        tempContainer.style.whiteSpace = 'normal'; // Standard wrapping
        tempContainer.style.overflow = 'visible';
    }

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

        // Banner Mode Clipping Check
        if (orientation === 'landscape') {
            // In landscape, the rendered HEIGHT becomes the strip WIDTH.
            // So contentHeight must be <= usableWidth.
            if (contentHeight > usableWidth) {
                warnings.push(`Warning: Content height (${Math.round(contentHeight)}px) exceeds printable width (${usableWidth}px). It will be clipped.`);
            }
        }

        // Render the content to a temporary canvas
        const sourceCanvas = await window.html2canvas(tempContainer, {
            backgroundColor: '#ffffff',
            scale: 1,
            logging: false,
            // For landscape, we want to capture the full width
            width: contentWidth,
            height: contentHeight,
            windowWidth: Math.max(contentWidth, PRINTER_WIDTH) // ensure context is wide enough
        });

        // Create final canvas
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = 'white';

        if (orientation === 'landscape') {
            // LANDSCAPE (BANNER) MODE

            // Final Dimensions
            // Width: Fixed at PRINTER_WIDTH
            // Height: contentWidth + paddingVertical * 2
            finalCanvas.width = PRINTER_WIDTH;
            finalCanvas.height = contentWidth + (paddingVertical * 2);

            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            ctx.save();

            // Align to Left Side (Top of Banner Text is Left of Strip)
            // PRINTER_WIDTH is the width of the strip.
            // We want text to start at paddingHorizontal.
            // This maps to the "Top" of the source text.

            // Transform:
            // Translate to Start Position:
            // X: paddingHorizontal
            // Y: finalCanvas.height - paddingVertical

            ctx.translate(paddingHorizontal, finalCanvas.height - paddingVertical);

            // Rotate -90 deg (CCW)
            ctx.rotate(-90 * Math.PI / 180);

            // Draw Image
            ctx.drawImage(sourceCanvas, 0, 0);

            ctx.restore();

        } else {
            // PORTRAIT MODE

            finalCanvas.width = PRINTER_WIDTH;
            finalCanvas.height = contentHeight + (paddingVertical * 2);

            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            // Draw centered horizontally
            // paddingHorizontal is the gap on left.
            // We rendered source at usableWidth.
            ctx.drawImage(sourceCanvas, paddingHorizontal, paddingVertical);
        }

        return { canvas: finalCanvas, warnings };

    } finally {
        document.body.removeChild(tempContainer);
    }
}
