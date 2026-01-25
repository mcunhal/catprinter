export class BaseBlock {
    constructor(manager, type) {
        this.manager = manager;
        this.type = type;
        this.id = 'blk_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Main container for the block
        this.container = document.createElement('div');
        this.container.className = 'block-wrapper';
        this.container.dataset.id = this.id;

        // Inner content area
        this.content = document.createElement('div');
        this.content.className = 'block-content';

        // Controls overlay (visible on hover)
        this.controls = document.createElement('div');
        this.controls.className = 'block-controls';

        this._renderControls();

        this.container.appendChild(this.content);
        this.container.appendChild(this.controls);
    }

    _renderControls() {
        // Move Up
        const upBtn = document.createElement('button');
        upBtn.innerHTML = '↑';
        upBtn.className = 'control-btn';
        upBtn.ariaLabel = 'Move block up';
        upBtn.onclick = () => this.manager.moveBlock(this.id, -1);

        // Move Down
        const downBtn = document.createElement('button');
        downBtn.innerHTML = '↓';
        downBtn.className = 'control-btn';
        downBtn.ariaLabel = 'Move block down';
        downBtn.onclick = () => this.manager.moveBlock(this.id, 1);

        // Delete
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'control-btn btn-delete';
        delBtn.ariaLabel = 'Delete block';
        delBtn.onclick = () => this.manager.removeBlock(this.id);

        this.controls.appendChild(upBtn);
        this.controls.appendChild(downBtn);
        this.controls.appendChild(delBtn);
    }

    // To be overridden by subclasses
    render() {
        return this.container;
    }

    // To be overridden by subclasses. Must return a Promise resolving to a Canvas.
    async renderCanvas() {
        throw new Error('renderCanvas() must be implemented');
    }

    destroy() {
        this.container.remove();
    }
}
