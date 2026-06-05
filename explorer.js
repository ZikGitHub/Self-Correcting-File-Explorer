/**
 * Independent File Explorer Component
 * Handles folder selection and tree rendering
 */

class FileExplorer {
    constructor(containerId, apiBase) {
        this.container = document.getElementById(containerId);
        this.apiBase = apiBase;
        this.currentRoot = null;
        this.activeFile = null;
        this.onFileSelect = null;
        
        // Modal for folder picking
        this.initPickerModal();

        // Ensure header controls are added when the DOM is fully ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initHeaderControls());
        } else {
            this.initHeaderControls();
        }
    }

    initPickerModal() {
        const modalHtml = `
            <div id="folder-picker-modal" class="modal-overlay" style="display:none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Open Folder</h3>
                        <button class="btn-close" onclick="document.getElementById('folder-picker-modal').style.display='none'">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="picker-path-input" class="path-input" placeholder="Path...">
                        <div id="picker-list" class="browse-list">
                            <!-- Folders will be listed here -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('folder-picker-modal').style.display='none'">Cancel</button>
                        <button class="btn btn-primary" id="btn-select-folder">Select Folder</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        this.pickerModal = document.getElementById('folder-picker-modal');
        this.pathInput = document.getElementById('picker-path-input');
        this.pickerList = document.getElementById('picker-list');
        this.selectBtn = document.getElementById('btn-select-folder');
        
        this.selectBtn.onclick = () => {
            const path = this.pathInput.value;
            if (path) {
                this.setRoot(path);
                this.pickerModal.style.display = 'none';
            }
        };
    }

    initHeaderControls() {
        // Find the explorer header (where "EXPLORER" text is)
        const sideBarHeader = document.querySelector('.side-bar-header');
        if (sideBarHeader && !sideBarHeader.querySelector('.explorer-actions')) {
            const actions = document.createElement('div');
            actions.className = 'explorer-actions';
            actions.innerHTML = `
                <i data-lucide="file-plus" title="New File" id="action-new-file" style="cursor:pointer"></i>
                <i data-lucide="folder-plus" title="New Folder" id="action-new-folder" style="cursor:pointer"></i>
                <i data-lucide="refresh-cw" title="Refresh" id="action-refresh" style="cursor:pointer"></i>
            `;
            sideBarHeader.appendChild(actions);

            document.getElementById('action-new-file').onclick = (e) => { e.stopPropagation(); this.createNewItem('file'); };
            document.getElementById('action-new-folder').onclick = (e) => { e.stopPropagation(); this.createNewItem('directory'); };
            document.getElementById('action-refresh').onclick = (e) => { e.stopPropagation(); this.refresh(); };
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    async showPicker(initialPath = '') {
        this.pickerModal.style.display = 'flex';
        // If initialPath is null or undefined, use empty string
        const startPath = initialPath || '';
        await this.browse(startPath);
    }

    async browse(path) {
        // Ensure path is a string
        const searchPath = (path === null || path === undefined) ? '' : path;
        
        try {
            const response = await fetch(`${this.apiBase}/browse?path=${encodeURIComponent(searchPath)}`);
            const data = await response.json();
            
            if (data.error) {
                console.error("Browse Error:", data.error);
                // Don't alert here to avoid spamming, just show error in list
                this.pickerList.innerHTML = `<div class="error-msg">${data.error}</div>`;
                return;
            }

            this.pathInput.value = data.current_path || '';
            this.pickerList.innerHTML = '';

            // Parent directory option
            if (data.parent_path && data.current_path) {
                const item = this.createBrowseItem('..', data.parent_path, 'folder');
                this.pickerList.appendChild(item);
            }

            data.folders.forEach(folder => {
                const item = this.createBrowseItem(folder.name, folder.path, folder.type === 'drive' ? 'database' : 'folder');
                this.pickerList.appendChild(item);
            });
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (e) {
            console.error("Browse failed:", e);
        }
    }

    createBrowseItem(name, path, icon) {
        const div = document.createElement('div');
        div.className = 'browse-item';
        div.innerHTML = `<i data-lucide="${icon}"></i><span>${name}</span>`;
        div.onclick = () => this.browse(path);
        return div;
    }

    async setRoot(path) {
        this.currentRoot = path;
        localStorage.setItem('last_project_root', path);
        await this.refresh();
        if (this.onRootChange) this.onRootChange(path);
    }

    async refresh() {
        if (!this.currentRoot) return;
        
        try {
            const response = await fetch(`${this.apiBase}/explorer/files?root_path=${encodeURIComponent(this.currentRoot)}`);
            const data = await response.json();
            
            if (data.tree) {
                this.container.innerHTML = '';
                this.renderTree(data.tree, this.container);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        } catch (e) {
            console.error("Refresh failed:", e);
        }
    }

    renderTree(nodes, container) {
        nodes.forEach(node => {
            const item = document.createElement('div');
            item.className = `tree-item ${node.type}`;
            if (this.activeFile === node.path) item.classList.add('active');
            
            const content = document.createElement('div');
            content.className = 'tree-item-content';
            
            if (node.type === 'directory') {
                content.innerHTML = `
                    <i data-lucide="chevron-right" class="chevron"></i>
                    <i data-lucide="folder" class="folder-icon"></i>
                    <span class="node-name">${node.name}</span>
                    <div class="node-actions">
                        <i data-lucide="edit-3" class="action-rename" title="Rename"></i>
                        <i data-lucide="trash-2" class="action-delete" title="Delete"></i>
                    </div>
                `;
                
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                childrenContainer.style.display = 'none'; 
                
                content.onclick = (e) => {
                    if (e.target.closest('.node-actions')) return;
                    e.stopPropagation();
                    const isExpanded = item.classList.toggle('expanded');
                    childrenContainer.style.display = isExpanded ? 'block' : 'none';
                };
                
                item.appendChild(content);
                item.appendChild(childrenContainer);
                this.renderTree(node.children || [], childrenContainer);
            } else {
                content.innerHTML = `
                    <i data-lucide="file-code"></i>
                    <span class="node-name">${node.name}</span>
                    <div class="node-actions">
                        <i data-lucide="edit-3" class="action-rename" title="Rename"></i>
                        <i data-lucide="trash-2" class="action-delete" title="Delete"></i>
                    </div>
                `;
                content.onclick = (e) => {
                    if (e.target.closest('.node-actions')) return;
                    e.stopPropagation();
                    this.activeFile = node.path;
                    this.updateActiveState();
                    if (this.onFileSelect) this.onFileSelect(node.path, node.name);
                };
                item.appendChild(content);
            }

            // Wire up actions
            const renameBtn = content.querySelector('.action-rename');
            const deleteBtn = content.querySelector('.action-delete');
            
            renameBtn.onclick = (e) => { e.stopPropagation(); this.renameItem(node.path, node.name); };
            deleteBtn.onclick = (e) => { e.stopPropagation(); this.deleteItem(node.path, node.name); };

            container.appendChild(item);
        });
    }

    async createNewItem(type) {
        if (!this.currentRoot) return;
        const name = prompt(`Enter ${type} name:`);
        if (!name) return;

        try {
            const response = await fetch(`${this.apiBase}/fs/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: this.currentRoot, type, name })
            });
            const data = await response.json();
            if (data.status === 'success') {
                this.refresh();
            } else {
                alert(data.error || "Failed to create item");
            }
        } catch (e) {
            console.error("Create failed:", e);
        }
    }

    async renameItem(path, oldName) {
        const newName = prompt("Enter new name:", oldName);
        if (!newName || newName === oldName) return;

        try {
            const response = await fetch(`${this.apiBase}/fs/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, newName })
            });
            const data = await response.json();
            if (data.status === 'success') {
                this.refresh();
            } else {
                alert(data.error || "Failed to rename item");
            }
        } catch (e) {
            console.error("Rename failed:", e);
        }
    }

    async deleteItem(path, name) {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;

        try {
            const response = await fetch(`${this.apiBase}/fs/delete?path=${encodeURIComponent(path)}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'success') {
                this.refresh();
            } else {
                alert(data.error || "Failed to delete item");
            }
        } catch (e) {
            console.error("Delete failed:", e);
        }
    }

    async saveFile(path, content) {
        try {
            const response = await fetch(`${this.apiBase}/fs/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, content })
            });
            return await response.json();
        } catch (e) {
            console.error("Save failed:", e);
            return { error: e.message };
        }
    }

    updateActiveState() {
        const items = this.container.querySelectorAll('.tree-item');
        items.forEach(item => {
            item.classList.remove('active');
            // This is a bit simplified, ideally we track by path
        });
        // Logic to find and highlight active path
    }
}

// Export for use
window.FileExplorer = FileExplorer;
