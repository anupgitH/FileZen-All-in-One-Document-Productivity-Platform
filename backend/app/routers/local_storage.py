
from pathlib import Path
from uuid import uuid4
import json
import re
import shutil

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/storage", tags=["Local Storage"])

BASE_DIR = Path(__file__).resolve().parents[2]
STORAGE_ROOT = BASE_DIR / "storage"
STORAGE_DIR = STORAGE_ROOT / "files"
TRASH_DIR = STORAGE_ROOT / "trash"
TRASH_DATA_DIR = TRASH_DIR / "data"
TRASH_META_DIR = TRASH_DIR / "metadata"

for directory in (STORAGE_DIR, TRASH_DATA_DIR, TRASH_META_DIR):
    directory.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024


def safe_name(name: str) -> str:
    """Return a safe single filename or folder name."""
    name = Path(name.replace("\\", "/")).name.strip()
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)

    if name in {"", ".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid name.")

    return name[:200]


def resolve_folder(folder: str = "") -> Path:
    """Resolve a folder without allowing access outside storage."""
    folder = folder.strip().replace("\\", "/").strip("/")
    root = STORAGE_DIR.resolve()
    target = (STORAGE_DIR / folder).resolve()

    if target != root and root not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid folder path.")

    if not target.exists():
        raise HTTPException(status_code=404, detail="Folder not found.")

    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Not a folder.")

    return target


def resolve_file(file_id: str) -> Path:
    """Find an active file by its generated ID."""
    if not re.fullmatch(r"[a-f0-9]{32}", file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID.")

    for path in STORAGE_DIR.rglob("*"):
        if path.is_file() and path.name.startswith(file_id + "__"):
            return path

    raise HTTPException(status_code=404, detail="File not found.")


def file_info(path: Path) -> dict:
    relative_folder = path.parent.relative_to(STORAGE_DIR).as_posix()
    if relative_folder == ".":
        relative_folder = ""

    file_id, original_name = path.name.split("__", 1)
    modified = path.stat().st_mtime

    return {
        "id": file_id,
        "name": original_name,
        "size": path.stat().st_size,
        "modified": modified,
        "modified_at": modified,
        "folder": relative_folder,
        "extension": path.suffix.lower(),
        "type": path.suffix.lstrip(".").lower() or "file",
    }


def metadata_path(trash_id: str) -> Path:
    if not re.fullmatch(r"[a-f0-9]{32}", trash_id):
        raise HTTPException(status_code=400, detail="Invalid Trash item ID.")

    return TRASH_META_DIR / f"{trash_id}.json"


def read_metadata(trash_id: str) -> dict:
    path = metadata_path(trash_id)

    if not path.is_file():
        raise HTTPException(status_code=404, detail="Trash item not found.")

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="Trash metadata is invalid.")


def save_metadata(trash_id: str, data: dict) -> None:
    metadata_path(trash_id).write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )


def trash_item(source: Path, kind: str) -> dict:
    """Move a file or folder into Trash and remember its original location."""
    if kind not in {"file", "folder"}:
        raise ValueError("Unsupported Trash item type.")

    trash_id = uuid4().hex
    original_folder = source.parent.relative_to(STORAGE_DIR).as_posix()

    if original_folder == ".":
        original_folder = ""

    data_path = TRASH_DATA_DIR / trash_id
    metadata = {
        "id": trash_id,
        "kind": kind,
        "name": source.name.split("__", 1)[1]
        if kind == "file"
        else source.name,
        "original_folder": original_folder,
        "original_filename": source.name if kind == "file" else None,
        "trashed_at": __import__("time").time(),
    }

    # Save metadata first so the original destination is known.
    save_metadata(trash_id, metadata)

    try:
        shutil.move(str(source), str(data_path))
    except Exception:
        metadata_path(trash_id).unlink(missing_ok=True)
        raise

    return metadata


class RenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CreateFolderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parent: str = ""


@router.get("/files")
def list_files(
    search: str = Query(default="", max_length=200),
    folder: str = Query(default=""),
):
    current_folder = resolve_folder(folder)
    search_lower = search.strip().lower()
    results = []

    for path in current_folder.iterdir():
        if not path.is_file() or "__" not in path.name:
            continue

        info = file_info(path)
        if search_lower and search_lower not in info["name"].lower():
            continue

        results.append(info)

    results.sort(key=lambda item: item["modified"], reverse=True)
    return {"files": results, "count": len(results)}


@router.get("/folders")
def list_folders(parent: str = Query(default="")):
    current_folder = resolve_folder(parent)
    folders = []

    for path in current_folder.iterdir():
        if path.is_dir():
            folders.append({
                "name": path.name,
                "path": path.relative_to(STORAGE_DIR).as_posix(),
            })

    folders.sort(key=lambda item: item["name"].lower())
    return {"folders": folders}


@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    folder: str = Query(default=""),
):
    destination_folder = resolve_folder(folder)
    uploaded = []

    for upload in files:
        original_name = safe_name(upload.filename or "uploaded-file")
        if "__" in original_name:
            original_name = original_name.replace("__", "_")

        file_id = uuid4().hex
        destination = destination_folder / f"{file_id}__{original_name}"
        total_size = 0

        try:
            with destination.open("wb") as output:
                while True:
                    chunk = await upload.read(1024 * 1024)
                    if not chunk:
                        break

                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=413,
                            detail=f"{original_name} exceeds the 100 MB limit.",
                        )

                    output.write(chunk)

            uploaded.append(file_info(destination))

        except Exception:
            destination.unlink(missing_ok=True)
            raise

        finally:
            await upload.close()

    return {"message": "Upload complete.", "files": uploaded}


@router.get("/download/{file_id}")
def download_file(file_id: str):
    path = resolve_file(file_id)
    original_name = path.name.split("__", 1)[1]

    return FileResponse(
        path=str(path),
        filename=original_name,
        media_type="application/octet-stream",
    )


@router.patch("/files/{file_id}/rename")
def rename_file(file_id: str, request: RenameRequest):
    path = resolve_file(file_id)
    new_name = safe_name(request.name)

    if "__" in new_name:
        raise HTTPException(
            status_code=400,
            detail="The filename cannot contain '__'.",
        )

    destination = path.parent / f"{file_id}__{new_name}"

    if destination.exists() and destination != path:
        raise HTTPException(
            status_code=409,
            detail="A file with that name already exists.",
        )

    path.rename(destination)
    return {"message": "File renamed.", "file": file_info(destination)}


@router.delete("/files/{file_id}")
def delete_file(file_id: str):
    """Move a file into Trash instead of permanently deleting it."""
    path = resolve_file(file_id)
    item = trash_item(path, "file")
    return {"message": "File moved to Trash.", "item": item}


@router.post("/folders")
def create_folder(request: CreateFolderRequest):
    parent = resolve_folder(request.parent)
    name = safe_name(request.name)

    if "__" in name:
        raise HTTPException(
            status_code=400,
            detail="Folder names cannot contain '__'.",
        )

    destination = parent / name

    if destination.exists():
        raise HTTPException(
            status_code=409,
            detail="A file or folder with that name already exists.",
        )

    destination.mkdir()
    return {
        "message": "Folder created.",
        "folder": {
            "name": name,
            "path": destination.relative_to(STORAGE_DIR).as_posix(),
        },
    }


@router.delete("/folders")
def delete_folder(path: str = Query(..., min_length=1)):
    """Move a folder and its contents to Trash as one recoverable item."""
    folder_path = resolve_folder(path)

    if folder_path == STORAGE_DIR.resolve():
        raise HTTPException(
            status_code=400,
            detail="The root storage folder cannot be deleted.",
        )

    item = trash_item(folder_path, "folder")
    return {"message": "Folder moved to Trash.", "item": item}


@router.get("/trash")
def list_trash():
    """List recoverable Trash items."""
    items = []

    for meta_file in TRASH_META_DIR.glob("*.json"):
        try:
            item = json.loads(meta_file.read_text(encoding="utf-8"))
            data_path = TRASH_DATA_DIR / item["id"]

            if not data_path.exists():
                continue

            item["size"] = (
                data_path.stat().st_size
                if data_path.is_file()
                else sum(
                    p.stat().st_size for p in data_path.rglob("*") if p.is_file()
                )
            )
            items.append(item)

        except (OSError, KeyError, json.JSONDecodeError):
            continue

    items.sort(key=lambda item: item.get("trashed_at", 0), reverse=True)
    return {"items": items, "count": len(items)}


@router.post("/trash/{trash_id}/restore")
def restore_trash_item(trash_id: str):
    """Restore a file or folder to its original location."""
    item = read_metadata(trash_id)
    source = TRASH_DATA_DIR / trash_id

    if not source.exists():
        raise HTTPException(status_code=404, detail="Trash item data not found.")

    original_folder = item.get("original_folder", "")
    try:
        parent = resolve_folder(original_folder)
    except HTTPException:
        raise HTTPException(
            status_code=404,
            detail="Original folder no longer exists. Recreate it before restoring.",
        )

    if item["kind"] == "file":
        original_filename = item.get("original_filename")
        if not original_filename or "__" not in original_filename:
            raise HTTPException(status_code=500, detail="Invalid file metadata.")

        destination = parent / original_filename
    else:
        destination = parent / item["name"]

    if destination.exists():
        raise HTTPException(
            status_code=409,
            detail="A file or folder with that name already exists at the original location.",
        )

    shutil.move(str(source), str(destination))
    metadata_path(trash_id).unlink(missing_ok=True)

    return {"message": "Item restored successfully.", "item": item}


@router.delete("/trash/{trash_id}")
def permanently_delete_trash_item(trash_id: str):
    """Permanently delete one item from Trash."""
    item = read_metadata(trash_id)
    source = TRASH_DATA_DIR / trash_id

    if source.is_dir():
        shutil.rmtree(source)
    else:
        source.unlink(missing_ok=True)

    metadata_path(trash_id).unlink(missing_ok=True)
    return {"message": f'"{item["name"]}" permanently deleted.'}


@router.delete("/trash")
def empty_trash():
    """Permanently remove every item in Trash."""
    deleted_count = 0

    for path in TRASH_DATA_DIR.iterdir():
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink(missing_ok=True)
        deleted_count += 1

    for path in TRASH_META_DIR.glob("*.json"):
        path.unlink(missing_ok=True)

    return {
        "message": "Trash emptied.",
        "deleted_count": deleted_count,
    }
