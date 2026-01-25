import { logger } from './logger.js';
import { printImage } from './printer.js';

export class BlockManager {
    constructor(containerElement) {
        if (!containerElement) throw new Error('BlockManager requires a container element');
        this.container = containerElement;
        this.blocks = [];
    }

    addBlock(block) {
        this.blocks.push(block);
        this.container.appendChild(block.render());

        // Auto-scroll to the new block
        block.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    removeBlock(id) {
        if (confirm('Delete this block?')) {
            const index = this.blocks.findIndex(b => b.id === id);
            if (index !== -1) {
                const block = this.blocks[index];
                block.destroy();
                this.blocks.splice(index, 1);
            }
        }
    }

    moveBlock(id, direction) {
        const index = this.blocks.findIndex(b => b.id === id);
        if (index === -1) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.blocks.length) return;

        // Move in array
        const block = this.blocks[index];
        this.blocks.splice(index, 1);
        this.blocks.splice(newIndex, 0, block);

        // Re-order DOM
        this._reorderDOM();
    }

    _reorderDOM() {
        // Appending an existing child moves it
        this.blocks.forEach(b => this.container.appendChild(b.container));
    }

    getBlockCount() {
        return this.blocks.length;
    }

    async printAll(options = {}) {
        if (this.blocks.length === 0) {
            throw new Error("Canvas is empty");
        }

        logger.info(`Starting print job for ${this.blocks.length} blocks`);

        // We print sequentially. The printer driver handles the queueing/blocking.
        let i = 0;
        for (const block of this.blocks) {
            i++;
            try {
                // Visual feedback: highlight printing block
                block.container.classList.add('printing-active');

                const canvas = await block.renderCanvas();
                if (canvas) {
                     logger.info(`Printing block ${i}/${this.blocks.length} (${block.type})`);
                     await printImage(canvas, options);
                }
            } catch (err) {
                logger.error(`Failed to print block ${i}`, err);
                throw err;
            } finally {
                block.container.classList.remove('printing-active');
            }
        }

        logger.success('All blocks printed!');
    }
}
