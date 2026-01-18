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
        tempContainer.style.width = 'auto'; // Allow growing wide
        tempContainer.style.height = 'auto';
        tempContainer.style.whiteSpace = 'pre'; // Disable wrapping, respect newlines
        tempContainer.style.display = 'inline-block'; // Ensure it wraps content tightly
        // Note: inline-block might affect ql-editor styles?
        // ql-editor usually expects block. Let's try min-width
        tempContainer.style.minWidth = '100px';
    } else {
        // Portrait Mode
        // Standard width constraint
        tempContainer.style.width = `${usableWidth}px`;
        tempContainer.style.height = 'auto';
        tempContainer.style.whiteSpace = 'normal'; // Standard wrapping
        tempContainer.style.overflow = 'visible';
    }

    // Apply padding to the temporary container?
    // No, padding is applied to the final canvas.
    // Wait, for Portrait, if we set width to usableWidth, the content fills that.
    // If we want the text to look padded, we can add padding to tempContainer,
    // but then we need to increase tempContainer width to match PRINTER_WIDTH?
    // User requirement: "padding is with reference to the print strip, not the position of the text."

    // Implementation Decision:
    // Render content tight (width = usableWidth).
    // Then paste onto final canvas at offset (paddingHorizontal, paddingVertical).

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
            // Source: [Wide Content] x [Height constrained to usableWidth]
            // Dest:   [PRINTER_WIDTH] x [Long Strip based on content Width]

            // Final Dimensions
            // Width: Fixed at PRINTER_WIDTH
            // Height: contentWidth + paddingVertical * 2
            finalCanvas.width = PRINTER_WIDTH;
            finalCanvas.height = contentWidth + (paddingVertical * 2);

            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            // Rotate 90 degrees clockwise?
            // "Orientation of printing by 90 degrees"
            // If I hold the paper strip:
            // Portrait:
            // [ A B C ]
            // [ D E F ]
            //
            // Landscape (Banner):
            // Text "A" should be printed such that if I rotate the paper 90 deg, I read "A".
            // Printer prints top row first.
            // Row 1: Left side of A ...
            // This effectively means rotating the Source Image 90 degrees Clockwise or Counter-Clockwise?
            // Usually Banner text runs "down" the strip.
            // Text: "HELLO"
            // H
            // E
            // L
            // ...
            // This is -90 deg (Counter Clockwise) relative to standard text?
            // Or +90?
            // Let's assume standard "Rotate Right" (Clockwise) so top of text is Right side of paper.

            ctx.save();

            // Translate to center of where we want to draw
            // We want to draw the source image rotated.
            // Center of final canvas: (384/2, finalHeight/2)
            // But it's easier to map corners.

            // Rotate 90 deg CW:
            // (x, y) -> (-y, x)
            // We want the text to start at top of strip (plus paddingVertical).

            // Let's translate to the top-right area where the text starts?
            // Better: Translate to (PRINTER_WIDTH / 2, finalCanvas.height / 2) ? No.

            // Let's Rotate 90deg CW.
            // Origin becomes Top-Right. X points Down. Y points Left.

            // Let's try explicit mapping.
            // We want source (0,0) (Top-Left of text) to end up at (Start X, Start Y).
            // If we rotate 90 deg CW:
            // Top-Left of text "H" -> Top-Right of paper?
            // Then text reads down the paper.
            // Top of text faces right edge of paper.

            // Center the content in the printable width (vertical in source, horizontal in dest)
            // Printable width on paper is usableWidth.
            // We have paddingHorizontal on both sides.

            // Move to center of width
            ctx.translate(PRINTER_WIDTH / 2, paddingVertical + contentWidth / 2);
            ctx.rotate(90 * Math.PI / 180);

            // Draw Image
            // Image center is at (contentWidth/2, contentHeight/2)
            // We want to draw it centered at current origin.
            ctx.drawImage(sourceCanvas, -contentWidth / 2, -contentHeight / 2);

            ctx.restore();

        } else {
            // PORTRAIT MODE
            // Source: [usableWidth] x [Height]
            // Dest:   [PRINTER_WIDTH] x [Height + paddingVertical * 2]

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
