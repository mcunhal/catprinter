import { logger } from './logger.js';
import { printImage } from './printer.js';

export class BlockManager {
    constructor(containerElement) {
        if (!containerElement) throw new Error('BlockManager requires a container element');
        this.container = containerElement;
        this.blocks = [];
        this._initSortable();
    }

    _initSortable() {
        if (typeof Sortable !== 'undefined') {
            this.sortable = new Sortable(this.container, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: (evt) => {
                    this._syncOrder();
                }
            });
        } else {
            logger.warn('SortableJS not found. Drag and drop disabled.');
        }
    }

    _syncOrder() {
        // Reorder blocks array to match DOM
        const newBlocks = [];
        const domElements = Array.from(this.container.children);

        domElements.forEach(el => {
            const id = el.dataset.id;
            const block = this.blocks.find(b => b.id === id);
            if (block) {
                newBlocks.push(block);
            }
        });

        this.blocks = newBlocks;
    }

    addBlock(block) {
        this.blocks.push(block);
        this.container.appendChild(block.render());

        // Auto-scroll to the new block
        block.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    removeBlock(id) {
        // Check for "Don't ask again" setting
        const confirmDelete = document.getElementById('confirmDeleteOption');
        const shouldConfirm = confirmDelete ? confirmDelete.checked : true;

        if (!shouldConfirm || confirm('Delete this block?')) {
            const index = this.blocks.findIndex(b => b.id === id);
            if (index !== -1) {
                const block = this.blocks[index];
                block.destroy();
                this.blocks.splice(index, 1);
            }
        }
    }

    getBlockCount() {
        return this.blocks.length;
    }

    setPreviewMode(active) {
        this.blocks.forEach(block => {
            if (typeof block.onPreviewMode === 'function') {
                block.onPreviewMode(active);
            }
        });
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
