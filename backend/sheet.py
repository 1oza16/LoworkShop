from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup
from html import escape
from weasyprint import HTML
from urllib.parse import unquote, quote
from uuid import uuid4
import os
import shutil
from core import filesystem
from . import database
from .album import INDEX_IMAGES
import re

def api_list_sheets(handler):

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
                    "imageId": get_sheet_image_id(ruta)
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

def api_get_sheet(handler):

    nombre = handler.path.removeprefix("/api/get-sheet/")
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

def api_create_sheet(handler):

    connection = None
    temporary_html = None
    temporary_pdf = None
    backup_html = None
    backup_pdf = None
    replaced_html = False
    replaced_pdf = False
    committed = False

    try:

        data = handler.read_json()
        if not isinstance(data, dict):
            return handler.send_json(
                400,
                {"error": "Los datos para crear la hoja no son válidos."}
            )

        client_uuid = data.get("clientUuid")
        model_uuid = data.get("modelUuid")
        matricula = data.get("plate")
        fecha = data.get("date")
        kilometraje = data.get("mileage")
        unidad_kilometraje = data.get("mileageUnit")

        if not all(
            isinstance(value, str)
            for value in (client_uuid, model_uuid, matricula, fecha)
        ):
            return handler.send_json(
                400,
                {"error": "Faltan datos para crear la hoja."}
            )

        matricula = matricula.strip()
        fecha = fecha.strip()
        if not client_uuid or not model_uuid or not matricula or not fecha:
            return handler.send_json(
                400,
                {
                    "error": "Faltan datos para crear la hoja."
                }
            )

        if kilometraje in (None, ""):
            kilometraje = None
        elif (
            not isinstance(kilometraje, int)
            or isinstance(kilometraje, bool)
            or kilometraje < 0
        ):
            return handler.send_json(
                400,
                {"error": "El kilometraje no es válido."}
            )

        if unidad_kilometraje not in ("km", "millas"):
            return handler.send_json(
                400,
                {"error": "La unidad de kilometraje no es válida."}
            )

        try:
            fecha = datetime.strptime(fecha, "%Y-%m-%d")
        except ValueError:
            return handler.send_json(
                400,
                {"error": "El formato de fecha no es válido."}
            )

        connection = database.connect()
        cliente = connection.execute(
            "SELECT nombre FROM clientes WHERE uuid = ?",
            (client_uuid,)
        ).fetchone()
        modelo = connection.execute(
            "SELECT nombre, marca_uuid FROM modelos WHERE uuid = ?",
            (model_uuid,)
        ).fetchone()
        if not cliente or not modelo:
            return handler.send_json(
                400,
                {"error": "El cliente o modelo seleccionado no existe."}
            )

        cliente = cliente["nombre"]
        brand_uuid = modelo["marca_uuid"]
        modelo = modelo["nombre"]
        marca = connection.execute(
            "SELECT nombre FROM marcas WHERE uuid = ?",
            (brand_uuid,)
        ).fetchone()["nombre"]
        nombre = generate_sheet_name(cliente, matricula, modelo, fecha)
        ficha_uuid = str(uuid4())
        ruta_html = filesystem.NOTES / f"{nombre}.html"
        ruta_pdf = filesystem.PDF / f"{nombre}.pdf"

        connection.execute(
            "DELETE FROM fichas WHERE nombre_ficha = ?",
            (ruta_html.name,)
        )
        connection.execute(
            """
            INSERT INTO fichas (
                uuid, cliente_uuid, modelo_uuid, matricula,
                kilometraje, fecha, nombre_ficha
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ficha_uuid,
                client_uuid,
                model_uuid,
                matricula,
                kilometraje,
                fecha.strftime("%Y-%m-%d"),
                ruta_html.name
            )
        )

        with (filesystem.STENCIL / "loworkshop_sheet.html").open(
            "r",
            encoding="utf-8"
        ) as file:
            html = file.read()

        cliente_html = escape(cliente)
        matricula_html = escape(matricula)
        modelo_html = escape(modelo)
        fecha_html = escape(fecha.strftime("%Y-%m-%d"))
        kilometraje_html = escape(
            "" if kilometraje is None else str(kilometraje)
        )

        html = html.replace("{FICHA_UUID}", ficha_uuid)
        html = html.replace("{CLIENT_UUID}", client_uuid)
        html = html.replace("{BRAND_UUID}", brand_uuid)
        html = html.replace("{MODEL_UUID}", model_uuid)
        html = html.replace("{CLIENTE}", cliente_html)
        html = html.replace("{MARCA}", escape(marca))
        html = html.replace("{MATRICULA}", matricula_html)
        html = html.replace("{MODELO}", modelo_html)
        html = html.replace("{FECHA}", fecha_html)
        html = html.replace("{KILOMETRAJE}", kilometraje_html)
        html = html.replace(
            "{KM_SELECTED}",
            "selected" if unidad_kilometraje == "km" else ""
        )
        html = html.replace(
            "{MILLAS_SELECTED}",
            "selected" if unidad_kilometraje == "millas" else ""
        )

        filesystem.NOTES.mkdir(parents=True, exist_ok=True)
        filesystem.PDF.mkdir(parents=True, exist_ok=True)
        temporary_html = filesystem.NOTES / f".{ficha_uuid}.html.tmp"
        temporary_pdf = filesystem.PDF / f".{ficha_uuid}.pdf.tmp"
        backup_html = filesystem.NOTES / f".{ficha_uuid}.html.backup"
        backup_pdf = filesystem.PDF / f".{ficha_uuid}.pdf.backup"

        temporary_html.write_text(html, encoding="utf-8")
        HTML(
            string=html,
            base_url=filesystem.NOTES
        ).write_pdf(temporary_pdf)

        if ruta_html.exists():
            shutil.copy2(ruta_html, backup_html)
        if ruta_pdf.exists():
            shutil.copy2(ruta_pdf, backup_pdf)

        os.replace(temporary_html, ruta_html)
        replaced_html = True
        os.replace(temporary_pdf, ruta_pdf)
        replaced_pdf = True
        connection.commit()
        committed = True

        for backup in (backup_html, backup_pdf):
            if backup.exists():
                try:
                    backup.unlink()
                except OSError as error_limpieza:
                    print("ERROR ELIMINANDO COPIA TEMPORAL:", error_limpieza)

        return handler.send_json(
            200,
            {
                "ok": True,
                "nombre": ruta_html.name
            }
        )

    except Exception as e:

        print("ERROR CREANDO HOJA:", e)

        try:
            if connection and not committed:
                connection.rollback()
            if not committed:
                if replaced_html:
                    if backup_html and backup_html.exists():
                        os.replace(backup_html, ruta_html)
                    elif ruta_html.exists():
                        ruta_html.unlink()
                elif backup_html and backup_html.exists():
                    backup_html.unlink()
                if replaced_pdf:
                    if backup_pdf and backup_pdf.exists():
                        os.replace(backup_pdf, ruta_pdf)
                    elif ruta_pdf.exists():
                        ruta_pdf.unlink()
                elif backup_pdf and backup_pdf.exists():
                    backup_pdf.unlink()
        except Exception as error_limpieza:
            print("ERROR LIMPIANDO CREACIÓN PARCIAL:", error_limpieza)

        return handler.send_json(
            500,
            {
                "error": "No se pudo crear la hoja."
            }
        )
    finally:
        if connection:
            connection.close()
        for temporary in (temporary_html, temporary_pdf):
            if temporary and temporary.exists():
                try:
                    temporary.unlink()
                except OSError as error_limpieza:
                    print("ERROR ELIMINANDO ARCHIVO TEMPORAL:", error_limpieza)
    
# Actualiza la ficha y reemplaza sus archivos como una sola operación.
def sync_sheet_record_and_files(
    ficha_uuid,
    current_name,
    header_data,
    html=None,
    pdf_html=None,
    overwrite=False
):
    if (
        not isinstance(current_name, str)
        or not current_name
        or Path(current_name).name != current_name
    ):
        raise ValueError("El nombre de la hoja no es válido.")

    current_filename = (
        current_name
        if current_name.lower().endswith(".html")
        else f"{current_name}.html"
    )
    current_html = filesystem.NOTES / current_filename
    if not current_html.is_file():
        raise FileNotFoundError(f"No existe la hoja: {current_html}")

    if not isinstance(header_data, dict):
        raise ValueError("Los datos de cabecera no son válidos.")

    client_uuid = header_data.get("clienteUuid")
    model_uuid = header_data.get("modeloUuid")
    matricula = header_data.get("matricula")
    fecha = header_data.get("fecha")
    kilometraje = header_data.get("kilometraje")
    if not all(
        isinstance(value, str)
        for value in (ficha_uuid, client_uuid, model_uuid, matricula, fecha)
    ):
        raise ValueError("Los datos de cabecera no son válidos.")

    matricula = matricula.strip()
    if not matricula:
        raise ValueError("La matrícula no puede estar vacía.")
    try:
        fecha = datetime.strptime(fecha, "%Y-%m-%d")
    except ValueError as error:
        raise ValueError("La fecha de cabecera no es válida.") from error

    if kilometraje in (None, ""):
        kilometraje = None
    else:
        if isinstance(kilometraje, bool):
            raise ValueError("El kilometraje no es válido.")
        try:
            kilometraje = int(kilometraje)
        except (TypeError, ValueError) as error:
            raise ValueError("El kilometraje no es válido.") from error
        if kilometraje < 0:
            raise ValueError("El kilometraje no es válido.")

    connection = database.connect()
    token = str(uuid4())
    temporary_html = filesystem.NOTES / f".{token}.html.tmp"
    temporary_pdf = filesystem.PDF / f".{token}.pdf.tmp"
    backups = {}
    managed_paths = []
    existed_before = {}
    committed = False
    rollback_complete = True

    try:
        ficha = connection.execute(
            """
            SELECT uuid
            FROM fichas
            WHERE uuid = ? AND nombre_ficha = ?
            """,
            (ficha_uuid, current_filename)
        ).fetchone()
        cliente = connection.execute(
            "SELECT uuid, nombre FROM clientes WHERE uuid = ?",
            (client_uuid,)
        ).fetchone()
        modelo = connection.execute(
            "SELECT uuid, nombre, marca_uuid FROM modelos WHERE uuid = ?",
            (model_uuid,)
        ).fetchone()
        if not ficha or not cliente or not modelo:
            raise ValueError(
                "La ficha no corresponde a la hoja indicada o el cliente/modelo no existe."
            )

        marca = connection.execute(
            "SELECT uuid, nombre FROM marcas WHERE uuid = ?",
            (modelo["marca_uuid"],)
        ).fetchone()
        if not marca:
            raise ValueError("La marca seleccionada no existe.")

        filename = (
            f"{generate_sheet_name(cliente['nombre'], matricula, modelo['nombre'], fecha)}"
            ".html"
        )
        new_html = filesystem.NOTES / filename
        new_pdf = filesystem.PDF / f"{Path(filename).stem}.pdf"
        conflicting_records = connection.execute(
            """
            SELECT uuid
            FROM fichas
            WHERE nombre_ficha = ? AND uuid != ?
            """,
            (filename, ficha_uuid)
        ).fetchall()
        renamed = new_html != current_html
        if renamed and (
            new_html.exists() or new_pdf.exists() or conflicting_records
        ) and not overwrite:
            return {
                "ok": False,
                "conflict": True,
                "renamed": True,
                "newName": filename,
                "newUrl": f"/notas/{quote(filename)}"
            }

        if html is None:
            html = current_html.read_text(encoding="utf-8")
        if not isinstance(html, str):
            raise ValueError("El contenido de la hoja no es válido.")
        if pdf_html is not None and not isinstance(pdf_html, str):
            raise ValueError("El contenido PDF de la hoja no es válido.")

        soup = _update_sheet_header(
            html,
            cliente,
            marca,
            modelo,
            matricula,
            fecha,
            kilometraje,
            connection
        )
        html = str(soup)
        html_pdf = _prepare_sheet_pdf(html, pdf_html)

        filesystem.NOTES.mkdir(parents=True, exist_ok=True)
        filesystem.PDF.mkdir(parents=True, exist_ok=True)
        managed_paths = list(dict.fromkeys((
            current_html,
            filesystem.PDF / f"{Path(current_filename).stem}.pdf",
            new_html,
            new_pdf
        )))
        existed_before = {path: path.exists() for path in managed_paths}
        for path in managed_paths:
            if path.exists():
                backup = path.with_name(f".{token}-{path.name}.backup")
                shutil.copy2(path, backup)
                backups[path] = backup

        temporary_html.write_text(html, encoding="utf-8")
        HTML(
            string=html_pdf,
            base_url=filesystem.NOTES
        ).write_pdf(temporary_pdf)

        connection.execute(
            "DELETE FROM fichas WHERE nombre_ficha = ? AND uuid != ?",
            (filename, ficha_uuid)
        )
        cursor = connection.execute(
            """
            UPDATE fichas
            SET cliente_uuid = ?,
                modelo_uuid = ?,
                matricula = ?,
                kilometraje = ?,
                fecha = ?,
                nombre_ficha = ?
            WHERE uuid = ?
            """,
            (
                client_uuid,
                model_uuid,
                matricula,
                kilometraje,
                fecha.strftime("%Y-%m-%d"),
                filename,
                ficha_uuid
            )
        )
        if cursor.rowcount == 0:
            raise ValueError("La ficha no existe en la base de datos.")

        os.replace(temporary_html, new_html)
        os.replace(temporary_pdf, new_pdf)
        if renamed:
            old_pdf = filesystem.PDF / f"{Path(current_filename).stem}.pdf"
            if current_html.exists():
                current_html.unlink()
            if old_pdf.exists():
                old_pdf.unlink()
        connection.commit()
        committed = True

        for backup in backups.values():
            try:
                backup.unlink()
            except OSError as error_limpieza:
                print("ERROR ELIMINANDO COPIA DE SEGURIDAD:", error_limpieza)

        return {
            "ok": True,
            "renamed": renamed,
            "newName": filename,
            "newUrl": f"/notas/{quote(filename)}",
            "title": soup.title.string if soup.title else Path(filename).stem
        }
    except Exception:
        if not committed:
            connection.rollback()
            for path in managed_paths:
                try:
                    if path in backups and backups[path].exists():
                        os.replace(backups[path], path)
                    elif not existed_before.get(path, True) and path.exists():
                        path.unlink()
                except OSError as error_limpieza:
                    rollback_complete = False
                    print("ERROR RESTAURANDO ARCHIVO DE FICHA:", error_limpieza)
        raise
    finally:
        connection.close()
        for temporary in (temporary_html, temporary_pdf):
            if temporary.exists():
                try:
                    temporary.unlink()
                except OSError as error_limpieza:
                    print("ERROR ELIMINANDO ARCHIVO TEMPORAL:", error_limpieza)
        if committed or rollback_complete:
            for backup in backups.values():
                if backup.exists():
                    try:
                        backup.unlink()
                    except OSError as error_limpieza:
                        print("ERROR ELIMINANDO COPIA DE SEGURIDAD:", error_limpieza)


def _update_sheet_header(
    html,
    client,
    brand,
    model,
    matricula,
    fecha,
    kilometraje,
    connection
):
    soup = BeautifulSoup(html, "html.parser")
    clients = connection.execute(
        "SELECT uuid, nombre FROM clientes ORDER BY nombre COLLATE NOCASE"
    ).fetchall()
    brands = connection.execute(
        "SELECT uuid, nombre FROM marcas ORDER BY nombre COLLATE NOCASE"
    ).fetchall()
    models = connection.execute(
        """
        SELECT uuid, nombre
        FROM modelos
        WHERE marca_uuid = ?
        ORDER BY nombre COLLATE NOCASE
        """,
        (brand["uuid"],)
    ).fetchall()

    for element_id, records, selected in (
        ("cliente", clients, client["uuid"]),
        ("marca", brands, brand["uuid"]),
        ("modelo", models, model["uuid"])
    ):
        select = soup.find(id=element_id)
        if not select:
            continue
        select.clear()
        for record in records:
            option = soup.new_tag("option", value=record["uuid"])
            option.string = record["nombre"]
            if record["uuid"] == selected:
                option["selected"] = ""
            select.append(option)
        if element_id == "modelo":
            select.attrs.pop("disabled", None)

    for element_id, value in (
        ("matricula", matricula),
        ("fecha", fecha.strftime("%Y-%m-%d")),
        ("kilometraje", "" if kilometraje is None else str(kilometraje))
    ):
        element = soup.find(id=element_id)
        if element:
            element["value"] = value

    if soup.title:
        soup.title.string = (
            f"LoworkShop_{client['nombre']}_{matricula}"
        )
    return soup


def _prepare_sheet_pdf(html, pdf_html=None):
    source = BeautifulSoup(html, "html.parser")
    soup = BeautifulSoup(pdf_html or html, "html.parser")

    for image in soup.select("img[data-image-id]"):
        image_path = INDEX_IMAGES.get(image.get("data-image-id"))

        if image_path is not None:
            image["src"] = image_path.resolve().as_uri()

    source_controls = source.select(".info-grid .info-value")
    pdf_controls = soup.select(".info-grid .info-value")

    for source_control, pdf_control in zip(source_controls, pdf_controls):
        if source_control.name == "select":
            selected = source_control.find("option", selected=True)
            value = selected.get_text() if selected else ""
        else:
            value = source_control.get("value", "")
        pdf_control.clear()
        pdf_control.string = value

    for control in soup.select(
        ".precio-input, .precio-total-input, .info-value"
    ):
        if control.name == "span":
            continue
        span = soup.new_tag("span")
        span["class"] = control.get("class", [])
        if control.get("style"):
            span["style"] = control["style"]
        if control.name == "select":
            selected = control.find("option", selected=True)
            span.string = selected.get_text() if selected else ""
        else:
            span.string = control.get("value", "")
        control.replace_with(span)
    return str(soup)


def _send_sheet_sync_result(handler, result):
    if result.get("conflict"):
        return handler.send_json(
            409,
            {**result, "error": "Ya existe una hoja con ese nombre."}
        )
    return handler.send_json(200, result)


def _read_sheet_sync_payload(data, header_key, require_header=False):
    if not isinstance(data, dict):
        raise ValueError("Los datos de guardado no son válidos.")

    name = data.get("name")
    header_data = data.get(header_key)
    if not isinstance(name, str) or not name or Path(name).name != name:
        raise ValueError("El nombre de la hoja no es válido.")
    if header_data is None and not require_header:
        return name, None, False
    if not isinstance(header_data, dict) or not header_data.get("uuid"):
        raise ValueError("Los datos de cabecera no son válidos.")

    overwrite = data.get("overwrite", False)
    if not isinstance(overwrite, bool):
        raise ValueError("La opción de sobrescritura no es válida.")
    return name, header_data, overwrite


def api_save_sheet(handler):
    try:
        data = handler.read_json()
        name, header_data, overwrite = _read_sheet_sync_payload(
            data,
            "datosCabecera"
        )
        html = data.get("html")
        html_pdf = data.get("pdfHtml")
        if (
            not isinstance(html, str)
            or not isinstance(html_pdf, str)
        ):
            raise ValueError("Los datos de guardado no son válidos.")

        if header_data is not None:
            result = sync_sheet_record_and_files(
                header_data["uuid"],
                name,
                header_data,
                html,
                html_pdf,
                overwrite
            )
            return _send_sheet_sync_result(handler, result)

        ruta_html = filesystem.NOTES / f"{name}.html"
        if not ruta_html.is_file():
            raise FileNotFoundError(f"No existe la hoja: {ruta_html}")
        ruta_pdf = filesystem.PDF / f"{name}.pdf"
        html_pdf = _prepare_sheet_pdf(html, html_pdf)

        token = str(uuid4())
        temporary_html = filesystem.NOTES / f".{token}.html.tmp"
        temporary_pdf = filesystem.PDF / f".{token}.pdf.tmp"
        backup_html = filesystem.NOTES / f".{token}.html.backup"
        backup_pdf = filesystem.PDF / f".{token}.pdf.backup"
        if ruta_html.exists():
            shutil.copy2(ruta_html, backup_html)
        if ruta_pdf.exists():
            shutil.copy2(ruta_pdf, backup_pdf)
        replaced_html = False
        replaced_pdf = False
        try:
            temporary_html.write_text(html, encoding="utf-8")
            HTML(
                string=html_pdf,
                base_url=ruta_html.parent
            ).write_pdf(temporary_pdf)
            os.replace(temporary_html, ruta_html)
            replaced_html = True
            os.replace(temporary_pdf, ruta_pdf)
            replaced_pdf = True
        except Exception:
            if replaced_html:
                if backup_html.exists():
                    os.replace(backup_html, ruta_html)
                elif ruta_html.exists():
                    ruta_html.unlink()
            if replaced_pdf:
                if backup_pdf.exists():
                    os.replace(backup_pdf, ruta_pdf)
                elif ruta_pdf.exists():
                    ruta_pdf.unlink()
            raise
        finally:
            for path in (temporary_html, temporary_pdf, backup_html, backup_pdf):
                if path.exists():
                    path.unlink()
        return handler.send_json(200, {"ok": True})
    except ValueError as error:
        return handler.send_json(400, {"ok": False, "error": str(error)})
    except Exception as error:
        print("ERROR GUARDANDO HOJA:", error)
        return handler.send_json(
            500,
            {"ok": False, "error": str(error)}
        )


def api_update_sheet_metadata(handler):
    try:
        data = handler.read_json()
        name, header_data, overwrite = _read_sheet_sync_payload(
            data,
            "headerData",
            require_header=True
        )

        result = sync_sheet_record_and_files(
            header_data["uuid"],
            name,
            header_data,
            overwrite=overwrite
        )
        return _send_sheet_sync_result(handler, result)
    except ValueError as error:
        return handler.send_json(400, {"ok": False, "error": str(error)})
    except Exception as error:
        print("ERROR ACTUALIZANDO DATOS DE HOJA:", error)
        return handler.send_json(
            500,
            {"ok": False, "error": str(error)}
        )

def api_delete_sheet(handler):

    connection = None

    try:

        data = handler.read_json()
        if not isinstance(data, dict):
            return handler.send_json(
                400,
                {"error": "Los datos para eliminar la hoja no son válidos."}
            )

        nombre = data.get("name")

        if not isinstance(nombre, str) or not nombre or Path(nombre).name != nombre:
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

        nombre_pdf = Path(nombre).stem + ".pdf"
        ruta_pdf = filesystem.PDF / nombre_pdf

        with ruta_html.open("r", encoding="utf-8") as file:
            soup = BeautifulSoup(file.read(), "html.parser")
        ficha_meta = soup.find("meta", attrs={"name": "ficha-uuid"})
        ficha_uuid = ficha_meta.get("content") if ficha_meta else None

        connection = database.connect()
        if not ficha_uuid:
            ficha = connection.execute(
                "SELECT uuid FROM fichas WHERE nombre_ficha = ?",
                (nombre,)
            ).fetchone()
            ficha_uuid = ficha["uuid"] if ficha else None

        ruta_html.unlink()
        if ruta_pdf.is_file():
            ruta_pdf.unlink()

        if ficha_uuid:
            connection.execute(
                "DELETE FROM fichas WHERE uuid = ?",
                (ficha_uuid,)
            )
        connection.commit()

        return handler.send_json(
            200,
            {
                "ok": True
            }
        )

    except Exception as e:

        if connection:
            connection.rollback()
        print("ERROR ELIMINANDO HOJA:", e)

        return handler.send_json(
            500,
            {
                "error": "No se pudo eliminar la hoja."
            }
        )
    finally:
        if connection:
            connection.close()

def generate_sheet_name(cliente, matricula, modelo, fecha):

    cliente = cliente.strip().upper()
    matricula = matricula.strip().upper()
    modelo = modelo.strip().upper()

    # Eliminar caracteres no válidos para nombres de archivo
    cliente = re.sub(r'[<>:"/\\|?*]', '', cliente)
    matricula = re.sub(r'[<>:"/\\|?*]', '', matricula)
    modelo = re.sub(r'[<>:"/\\|?*]', '', modelo)
    fecha_str = fecha.strftime("%Y-%m-%d")

    return f"{cliente}_{matricula}_{modelo}_{fecha_str}"

def get_sheet_image_id(ruta_hoja):
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