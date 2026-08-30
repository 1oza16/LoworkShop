from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup
from html import escape
from weasyprint import HTML
from urllib.parse import unquote, quote
from core import filesystem
from .album import INDEX_IMAGES
import re

def api_listar_hojas(handler):

    try:

        hojas = []

        if filesystem.NOTES.exists():

            for ruta in filesystem.NOTES.iterdir():

                if not ruta.is_file() or ruta.suffix.lower() != ".html":
                    continue

                fecha = datetime.fromtimestamp(
                    ruta.stat().st_mtime
                )

                hojas.append({
                    "nombre": ruta.name,
                    "fecha": fecha.isoformat(),
                    "imageId": obtener_id_imagen_hoja(ruta)
                })

        hojas.sort(
            key=lambda hoja: hoja["fecha"],
            reverse=True
        )

        ahora = datetime.now()

        modificadas_este_mes = [
            hoja for hoja in hojas
            if (
                datetime.fromisoformat(hoja["fecha"]).month == ahora.month
                and
                datetime.fromisoformat(hoja["fecha"]).year == ahora.year
            )
        ]

        estadisticas = {
            "total": len(hojas),
            "modificadasEsteMes": len(modificadas_este_mes),
            "ultimaModificacion": (
                hojas[0]["fecha"]
                if hojas
                else None
            )
        }

        return handler.send_json(
            200,
            {
                "hojas": hojas,
                "estadisticas": estadisticas
            }
        )

    except Exception as e:

        print("ERROR LISTANDO HOJAS:", e)

        return handler.send_json(
            500,
            {
                "error": "No se pudieron cargar las hojas."
            }
        )

def api_retornar_hoja(handler):

    nombre = handler.path.removeprefix("/api/retornar-hoja/")
    nombre = unquote(nombre)

    # Evitar traversal y nombres inválidos
    if not nombre or Path(nombre).name != nombre:
        return handler.send_error(
            400,
            "Nombre de hoja no válido"
        )

    ruta_hoja = filesystem.NOTES / nombre

    if not ruta_hoja.is_file():
        return handler.send_error(
            404,
            "Hoja no encontrada"
        )

    try:
        host = handler.headers.get("Host")
        url = f"http://{host}/notas/{quote(nombre)}"

        return handler.send_json(
            200,
            {
                "ok": True,
                "url": url
            }
        )

    except Exception as e:

        print("ERROR RETORNANDO HOJA:", e)

        handler.send_error(
            500,
            "Error al cargar la hoja"
        )

def api_crear_hoja(handler):

    try:

        data = handler.read_json()

        cliente = data.get("client", "").strip()
        matricula = data.get("plate", "").strip()
        modelo = data.get("model", "").strip()
        fecha = data.get("date", "").strip()

        if not cliente or not matricula or not modelo or not fecha:
            return handler.send_json(
                400,
                {
                    "error": "Faltan datos para crear la hoja."
                }
            )

        try:
            fecha = datetime.strptime(fecha, "%Y-%m-%d")
        except ValueError:
            return handler.send_json(
                400,
                {"error": "El formato de fecha no es válido."}
            )

        # El backend genera el nombre
        nombre = generar_nombre_hoja(cliente, matricula, modelo, fecha)

        ruta_html = filesystem.NOTES / f"{nombre}.html"
        ruta_pdf = filesystem.PDF / f"{nombre}.pdf"

        # Leer plantilla
        with open(
            filesystem.STENCIL / "loworkshop_sheet.html",
            "r",
            encoding="utf-8"
        ) as f:
            html = f.read()

        # Escapar datos antes de insertarlos
        cliente_html = escape(cliente)
        matricula_html = escape(matricula)
        modelo_html = escape(modelo)
        fecha_html = escape(fecha.strftime("%Y-%m-%d"))

        html = html.replace(
            "{CLIENTE}",
            cliente_html
        )

        html = html.replace(
            "{MATRICULA}",
            matricula_html
        )

        html = html.replace(
            "{MODELO}",
            modelo_html
        )

        html = html.replace(
            "{FECHA}",
            fecha_html
        )
        
        # Crear HTML
        ruta_html.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with open(
            ruta_html,
            "w",
            encoding="utf-8"
        ) as f:
            f.write(html)

        # Generar PDF
        HTML(
            string=html,
            base_url=ruta_html.parent
        ).write_pdf(ruta_pdf)

        return handler.send_json(
            200,
            {
                "ok": True,
                "nombre": ruta_html.name
            }
        )

    except Exception as e:

        print("ERROR CREANDO HOJA:", e)

        # Evitar creación parcial
        try:
            if "ruta_html" in locals() and ruta_html.exists():
                ruta_html.unlink()

            if "ruta_pdf" in locals() and ruta_pdf.exists():
                ruta_pdf.unlink()

        except Exception as error_limpieza:

            print(
                "ERROR LIMPIANDO CREACIÓN PARCIAL:",
                error_limpieza
            )

        return handler.send_json(
            500,
            {
                "error": "No se pudo crear la hoja."
            }
        )
    
#  Guarda las hojas informativas en .html una vez finalizadas para poder modificarlas de nuevo (notas) y genera un .pdf con la información de la hoja (pdf).
def api_guardar_hoja(handler):

    try:
        data = handler.read_json()
        
        name = data["name"]
        html = data["html"]
        htmlPDF = data["pdfHtml"]

        soup = BeautifulSoup(htmlPDF, "html.parser")
        
        for img in soup.select("img[data-image-id]"):
            image_id = img.get("data-image-id")
            ruta = INDEX_IMAGES.get(image_id)

            if ruta is not None:
                img["src"] = ruta.resolve().as_uri()
        
        htmlPDF = str(soup)

        ruta_html = filesystem.NOTES/ f"{name}.html"

        if not ruta_html.is_file():

            raise Exception(
                f"No existe la hoja: {ruta_html}"
            )

        with ruta_html.open(
            "w",
            encoding="utf-8"
        ) as f:

            f.write(html)

        ruta_pdf = filesystem.PDF / f"{name}.pdf"

        from weasyprint import HTML

        HTML(
            string=htmlPDF,
            base_url=ruta_html.parent
        ).write_pdf(ruta_pdf)

        handler.send_json(
            200,
            {
                "ok": True
            }
        )

    except Exception as e:

        print(
            "ERROR GUARDANDO HOJA:",
            e
        )

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

def api_eliminar_hoja(handler):

    try:

        data = handler.read_json()

        nombre = data.get("name")

        if not nombre or Path(nombre).name != nombre:
            return handler.send_json(
                400,
                {
                    "error": "Nombre de hoja no válido."
                }
            )

        ruta_html = filesystem.NOTES / nombre

        if not ruta_html.is_file():
            return handler.send_json(
                404,
                {
                    "error": "La hoja no existe."
                }
            )

        ruta_html.unlink()

        nombre_pdf = Path(nombre).stem + ".pdf"
        ruta_pdf = filesystem.PDF / nombre_pdf

        if ruta_pdf.is_file():
            ruta_pdf.unlink()

        return handler.send_json(
            200,
            {
                "ok": True
            }
        )

    except Exception as e:

        print("ERROR ELIMINANDO HOJA:", e)

        return handler.send_json(
            500,
            {
                "error": "No se pudo eliminar la hoja."
            }
        )

def generar_nombre_hoja(cliente, matricula, modelo, fecha):

    cliente = cliente.strip()
    matricula = matricula.strip()
    modelo = modelo.strip()

    # Eliminar caracteres no válidos para nombres de archivo
    cliente = re.sub(r'[<>:"/\\|?*]', '', cliente)
    matricula = re.sub(r'[<>:"/\\|?*]', '', matricula)
    modelo = re.sub(r'[<>:"/\\|?*]', '', modelo)
    fecha_str = fecha.strftime("%Y-%m-%d")

    return f"{cliente}_{matricula}_{modelo}_{fecha_str}"

def obtener_id_imagen_hoja(ruta_hoja):
    """Obtiene el identificador de la imagen de catálogo de una hoja."""

    try:
        with ruta_hoja.open("r", encoding="utf-8") as archivo:
            soup = BeautifulSoup(archivo, "html.parser")

        model_img = soup.select_one("#modelImg[data-image-id]")

        if model_img is None:
            return None

        return model_img.get("data-image-id") or None

    except (OSError, UnicodeDecodeError) as e:
        print(f"ERROR LEYENDO IMAGEN DE HOJA {ruta_hoja.name}: {e}")
        return None