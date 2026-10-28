from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if not (ROOT / "assets").exists():
    ROOT = Path(sys.executable).resolve().parent

# Variables con las rutas absolutas
PHOTOS = ROOT / "fotos_coches"
COVERS = PHOTOS / "covers"
NOTES = ROOT / "notas"
PDF = ROOT / "pdf"
VIEWS = ROOT / "views"
STENCIL = ROOT / "stencil"
