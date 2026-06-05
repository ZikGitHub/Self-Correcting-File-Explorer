import os
import shutil
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class FSCreateRequest(BaseModel):
    path: str
    type: str  # 'file' or 'directory'
    name: str

class FSRenameRequest(BaseModel):
    path: str
    newName: str

class FSSaveRequest(BaseModel):
    path: str
    content: str

def get_directory_tree(path, project_root):
    """Recursively build a directory tree."""
    tree = []
    ignore_dirs = {'.git', 'venv', '.venv', '__pycache__', 'node_modules', '.gemini'}
    
    try:
        with os.scandir(path) as it:
            for entry in it:
                if entry.is_dir():
                    if entry.name in ignore_dirs:
                        continue
                    tree.append({
                        "name": entry.name,
                        "type": "directory",
                        "path": os.path.relpath(entry.path, project_root).replace("\\", "/"),
                        "children": get_directory_tree(entry.path, project_root)
                    })
                else:
                    tree.append({
                        "name": entry.name,
                        "type": "file",
                        "path": os.path.relpath(entry.path, project_root).replace("\\", "/"),
                    })
    except Exception as e:
        print(f"Error scanning directory {path}: {str(e)}")
        
    return sorted(tree, key=lambda x: (x["type"] != "directory", x["name"].lower()))

@app.get("/browse")
async def browse_path(path: str = Query(None)):
    """Browse the filesystem for folder selection."""
    if not path or path in ["undefined", "null", ""]:
        if os.name == 'nt':
            import string
            drives = [f"{d}:/" for d in string.ascii_uppercase if os.path.exists(f"{d}:/")]
            return {"current_path": "", "folders": [{"name": d, "path": d, "type": "drive"} for d in drives]}
        else:
            path = "/"
    
    path = os.path.abspath(path).replace("\\", "/")
    if not os.path.exists(path):
        return {"error": f"Path not found: {path}", "current_path": path}
    
    try:
        items = []
        with os.scandir(path) as it:
            for entry in it:
                if entry.is_dir():
                    items.append({"name": entry.name, "path": entry.path.replace("\\", "/"), "type": "directory"})
        items.sort(key=lambda x: x["name"].lower())
        
        parent_path = os.path.dirname(path).replace("\\", "/")
        if os.name == 'nt':
            norm_path = path.rstrip("/")
            if len(norm_path) == 2 and norm_path.endswith(":"):
                parent_path = ""
            elif path.endswith(":/") or path.endswith(":\\") or path == parent_path:
                parent_path = ""
                
        return {
            "current_path": path,
            "parent_path": parent_path,
            "folders": items
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/explorer/files")
async def explorer_files(root_path: str = Query(...)):
    """Get the file tree for any absolute path."""
    if not os.path.exists(root_path):
        return {"error": "Path not found", "tree": []}
    
    tree = get_directory_tree(root_path, root_path)
    return {"tree": tree, "root_path": root_path}

@app.get("/file")
async def get_file_content(path: str = Query(...)):
    """Read content of a file."""
    if not os.path.exists(path):
        return {"error": f"File not found: {path}"}
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        return {"error": str(e)}

@app.post("/fs/create")
async def fs_create(req: FSCreateRequest):
    """Create a new file or directory."""
    full_path = os.path.join(req.path, req.name).replace("\\", "/")
    try:
        if req.type == "directory":
            os.makedirs(full_path, exist_ok=True)
        else:
            with open(full_path, "w", encoding="utf-8") as f:
                f.write("")
        return {"status": "success", "path": full_path}
    except Exception as e:
        return {"error": str(e)}

@app.put("/fs/rename")
async def fs_rename(req: FSRenameRequest):
    """Rename a file or directory."""
    if not os.path.exists(req.path):
        return {"error": "Path not found"}
    
    parent_dir = os.path.dirname(req.path)
    new_path = os.path.join(parent_dir, req.newName).replace("\\", "/")
    
    try:
        os.rename(req.path, new_path)
        return {"status": "success", "newPath": new_path}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/fs/delete")
async def fs_delete(path: str = Query(...)):
    """Delete a file or directory."""
    if not os.path.exists(path):
        return {"error": "Path not found"}
    
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/fs/save")
async def fs_save(req: FSSaveRequest):
    """Save content to a file."""
    try:
        with open(req.path, "w", encoding="utf-8") as f:
            f.write(req.content)
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
