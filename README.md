# Self-Correcting File Explorer

A standalone filesystem-aware explorer component consisting of a FastAPI backend and a vanilla JavaScript/CSS frontend component. It is designed to be integrated into the Antigravity IDE but can be used as a standalone service.

## Features

- **Filesystem Browsing**: Recursively scan and list directory trees.
- **File Operations**: Create, rename, delete, and save files/directories.
- **Folder Picker**: Built-in modal for selecting root directories on the server.
- **RESTful API**: Clean FastAPI endpoints for all filesystem operations.

## Structure

- `api.py`: FastAPI backend server (Port 8001).
- `explorer.js`: Client-side `FileExplorer` class for rendering the tree and handling interactions.
- `explorer.css`: VS Code-inspired styling for the explorer and folder picker.

## Getting Started

### Prerequisites

- Python 3.8+
- FastAPI
- Uvicorn

Install dependencies:
```bash
pip install fastapi uvicorn
```

### Starting the Backend

To start the File Explorer API:

```bash
python api.py
```

The server will start on `http://localhost:8001`.

### Integration

To use the explorer in a web application:

1. Include `explorer.css` and `explorer.js`.
2. Instantiate the `FileExplorer` class:

```javascript
const explorer = new FileExplorer('explorer-container', 'http://localhost:8001');

// Show the folder picker to select a root
explorer.showPicker();

// Handle file selection
explorer.onFileSelect = (path) => {
    console.log('Selected file:', path);
};
```

## API Endpoints

- `GET /browse`: Navigate the server's filesystem for folder selection.
- `GET /explorer/files`: Fetch a recursive directory tree for a path.
- `GET /file`: Read file content.
- `POST /fs/create`: Create a new file or directory.
- `PUT /fs/rename`: Rename a file or directory.
- `DELETE /fs/delete`: Delete a file or directory.
- `POST /fs/save`: Save content to a file.
