export class BaseBlock {
    constructor(manager, type) {
        this.manager = manager;
        this.type = type;
        this.id = 'blk_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        // Main container for the block
        this.container = document.createElement('div');
        this.container.className = 'block-wrapper';
        this.container.dataset.id = this.id;

        // Header (Robust controls)
        this.header = document.createElement('div');
        this.header.className = 'block-header';

        // Inner content area
        this.content = document.createElement('div');
        this.content.className = 'block-content';

        this._renderHeader();

        this.container.appendChild(this.header);
        this.container.appendChild(this.content);
    }

    _renderHeader() {
        const title = document.createElement('span');
        title.className = 'block-title';
        title.innerText = this.type.charAt(0).toUpperCase() + this.type.slice(1);

        const controls = document.createElement('div');
        controls.className = 'block-header-controls';

        // Move Up
        const upBtn = document.createElement('button');
        upBtn.innerHTML = '↑';
        upBtn.className = 'header-btn';
        upBtn.ariaLabel = 'Move block up';
        upBtn.onclick = () => this.manager.moveBlock(this.id, -1);

        // Move Down
        const downBtn = document.createElement('button');
        downBtn.innerHTML = '↓';
        downBtn.className = 'header-btn';
        downBtn.ariaLabel = 'Move block down';
        downBtn.onclick = () => this.manager.moveBlock(this.id, 1);

        // Delete
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'header-btn btn-delete';
        delBtn.ariaLabel = 'Delete block';
        delBtn.onclick = () => this.manager.removeBlock(this.id);

        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        controls.appendChild(delBtn);

        this.header.appendChild(title);
        this.header.appendChild(controls);
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
