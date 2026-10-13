from core import filesystem
import json
import base64
import urllib
import urllib.request
import mimetypes
import shutil
from pathlib import Path, PurePosixPath
from uuid import uuid4
from urllib.parse import quote, unquote, urlsplit

INDEX = filesystem.PHOTOS / "index.json"
IMAGE_IDS = filesystem.PHOTOS / ".image_ids.json"
INDEX_IMAGES = {}
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
COVER_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
}
INVALID_ALBUM_NAME_CHARACTERS = set('<>:"/\\|?*')
RESERVED_WINDOWS_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10))
}

# Devuelve el catálogo de vehículos.
def api_get_cars_index(handler):

    try:

        ruta_json = INDEX

        if not ruta_json.is_file():
            generate_cars_index()

        with open(
            ruta_json,
            "r",
            encoding="utf-8"
        ) as f:

            datos = json.load(f)

        handler.send_json(
            200,
            datos
        )

    except Exception as e:

        print("ERROR CARGANDO INDEX:", e)
        
        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

def api_get_image(handler):

    image_id = handler.path.removeprefix("/api/get-image/")

    try:

        ruta = INDEX_IMAGES.get(image_id)

        if ruta is None or not ruta.is_file():

            handler.send_error(
                404,
                "Imagen no encontrada"
            )

            return

        mime = (
            mimetypes.guess_type(ruta)[0]
            or "application/octet-stream"
        )

        with open(
            ruta,
            "rb"
        ) as f:

            contenido = f.read()

        handler.send_response(200)

        handler.send_header(
            "Content-Type",
            mime
        )

        handler.send_header(
            "Content-Length",
            str(len(contenido))
        )

        handler.end_headers()

        handler.wfile.write(contenido)

    except Exception as e:

        print("ERROR ENVIANDO IMAGEN:", e)

        handler.send_error(
            500,
            str(e)
        )

def api_delete_image(handler):

    try:

        data = handler.read_json()

        image_id = data["id"]

        ruta = INDEX_IMAGES.get(image_id)

        if ruta is None or not ruta.is_file():

            return handler.send_json(
                404,
                {
                    "ok": False,
                    "mensaje": "Imagen no encontrada"
                }
            )

        _forget_image_path(ruta)
        ruta.unlink()

        generate_cars_index()

        return handler.send_json(
            200,
            {
                "ok": True
            }
        )

    except Exception as e:

        print("ERROR ELIMINANDO IMAGEN:", e)

        return handler.send_json(
            500,
            {
                "ok": False,
                "mensaje": str(e)
            }
        )
    
# Guarda las imagenes (locales en base64 o por url) en la biblioteca de vehículos (fotos_coches).
def api_save_photo(handler):

    try:

        data = handler.read_json()
        if not isinstance(data, dict):
            raise ValueError("La petición no es válida.")

        marca = _album_name(data.get("brand")) if data.get("brand") is not None else None
        modelo = _album_name(data.get("model")) if data.get("model") is not None else None
        nombre = _album_name(data.get("name"))
        imagen = data.get("image")
        overwrite = bool(data.get("overwrite", False))

        if not marca or not modelo:
            raise ValueError("La marca y el modelo son obligatorios.")

        carpeta_destino = filesystem.PHOTOS / marca / modelo
        carpeta_destino.mkdir(parents=True, exist_ok=True)

        nombre_base = Path(nombre).stem
        extension = _get_image_extension(nombre, imagen)
        ruta_archivo = carpeta_destino / f"{nombre_base}{extension}"

        if ruta_archivo.exists() and not overwrite:
            handler.send_json(409, {
                "ok": False,
                "conflict": True,
                "error": "La imagen ya existe."
            })
            return

        if ruta_archivo.exists() and overwrite:
            _forget_image_path(ruta_archivo)
            ruta_archivo.unlink()

        contenido = _get_image_content(imagen)

        with open(
            ruta_archivo,
            "wb"
        ) as f:

            f.write(contenido)

        resultado = generate_cars_index()

        handler.send_json(
            200,
            {
                "ok": True,
                "archivo": str(ruta_archivo),
                "indice": resultado
            }
        )

    except (ValueError, FileNotFoundError) as e:
        handler.send_json(
            400,
            {
                "ok": False,
                "error": str(e)
            }
        )
    except Exception as e:

        print("ERROR GUARDANDO IMAGEN:", e)

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )


def _get_image_extension(nombre, imagen):
    extension = Path(nombre).suffix.lower()
    if extension in VALID_EXTENSIONS:
        return extension

    if not isinstance(imagen, dict):
        raise ValueError("La imagen no es válida.")

    extension = (imagen.get("extension") or "").lower()
    if extension not in VALID_EXTENSIONS:
        raise ValueError("La imagen debe tener una extensión permitida.")

    return extension

def _get_image_content(imagen):
    if not isinstance(imagen, dict):
        raise ValueError("La imagen no es válida.")

    origen = imagen.get("origen")
    valor = imagen.get("valor")
    if not valor:
        raise ValueError("No hay contenido de imagen para guardar.")

    if origen == "url":
        req = urllib.request.Request(
            valor,
            headers={
                "User-Agent": "Mozilla/5.0"
            }
        )

        with urllib.request.urlopen(req) as response:
            return response.read()

    if origen == "base64":
        return base64.b64decode(valor)

    raise ValueError("El contenido de la imagen no es válido.")

def generate_cars_index():

    indice = {}
    image_ids = _load_image_ids()
    ids_by_path = {
        relative_path: image_id
        for image_id, relative_path in image_ids.items()
    }
    updated_image_ids = {}
    INDEX_IMAGES.clear()

    if not filesystem.PHOTOS.is_dir():
        filesystem.PHOTOS.mkdir(
            parents=True,
            exist_ok=True
        )

    for ruta_marca in filesystem.PHOTOS.iterdir():

        if not ruta_marca.is_dir():
            continue

        if ruta_marca.name == "covers":
            continue

        marca = ruta_marca.name

        modelos = {}

        for ruta_modelo in ruta_marca.iterdir():

            if not ruta_modelo.is_dir():
                continue

            modelo = ruta_modelo.name

            imagenes = []

            for ruta_imagen in ruta_modelo.iterdir():

                if (
                    ruta_imagen.is_file()
                    and ruta_imagen.suffix.lower() in VALID_EXTENSIONS
                ):
                    nombre = ruta_imagen.name
                    relative_path = ruta_imagen.relative_to(
                        filesystem.PHOTOS
                    ).as_posix()
                    imagen_id = ids_by_path.get(relative_path)
                    if imagen_id is None:
                        imagen_id = str(uuid4())

                    updated_image_ids[imagen_id] = relative_path
                    INDEX_IMAGES[imagen_id] = ruta_imagen

                    imagenes.append({
                        "id": imagen_id,
                        "nombre": nombre
                    })

            modelos[modelo] = imagenes

        indice[marca] = modelos

    if updated_image_ids != image_ids:
        _save_image_ids(updated_image_ids)

    with INDEX.open(
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            indice,
            f,
            ensure_ascii=False,
            indent=2
        )

    total_marcas = len(indice)
    total_modelos = sum(
        len(m)
        for m in indice.values()
    )
    total_imagenes = sum(
        len(imgs)
        for m in indice.values()
        for imgs in m.values()
    )

    return {
        "ok": True,
        "marcas": total_marcas,
        "modelos": total_modelos,
        "imagenes": total_imagenes
    }

def _load_image_ids():
    path = IMAGE_IDS
    if not path.is_file():
        return {}

    with path.open("r", encoding="utf-8") as file:
        image_ids = json.load(file)

    if not isinstance(image_ids, dict):
        raise ValueError("El registro de identificadores de imágenes no es válido.")

    return image_ids

def _save_image_ids(image_ids):
    with IMAGE_IDS.open("w", encoding="utf-8") as file:
        json.dump(image_ids, file, ensure_ascii=False, indent=2)

def _forget_image_path(path):
    target = path.resolve()
    image_ids = _load_image_ids()
    retained_ids = {
        image_id: relative_path
        for image_id, relative_path in image_ids.items()
        if not _is_inside(
            filesystem.PHOTOS.joinpath(*PurePosixPath(relative_path).parts).resolve(),
            target
        )
    }
    if retained_ids != image_ids:
        _save_image_ids(retained_ids)

def _update_image_registry_paths(moves):
    image_ids = _load_image_ids()
    for image_id, relative_path in image_ids.items():
        image_path = filesystem.PHOTOS.joinpath(
            *PurePosixPath(relative_path).parts
        )
        for source, destination in moves:
            try:
                source.relative_to(filesystem.PHOTOS)
                destination.relative_to(filesystem.PHOTOS)
                tail = image_path.relative_to(source)
            except ValueError:
                continue

            image_ids[image_id] = (destination / tail).relative_to(
                filesystem.PHOTOS
            ).as_posix()
            break

    _save_image_ids(image_ids)

def _is_inside(path, parent):
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False

#region Cover

def api_get_cover(handler):

    cover_id = unquote(
        urlsplit(handler.path).path.removeprefix("/api/get-cover/")
    )

    try:

        if not cover_id or "/" in cover_id or "\\" in cover_id:
            handler.send_error(404, "Portada no encontrada")
            return

        rutas = _cover_paths(cover_id)

        if not rutas:
            handler.send_error(404, "Portada no encontrada")
            return

        ruta = rutas[0]
        mime = COVER_MIME_TYPES[ruta.suffix.lower()]

        with open(ruta, "rb") as f:
            contenido = f.read()

        handler.send_response(200)

        handler.send_header(
            "Content-Type",
            mime
        )

        handler.send_header(
            "Content-Length",
            str(len(contenido))
        )

        handler.end_headers()

        handler.wfile.write(contenido)

    except Exception as e:
        print("ERROR ENVIANDO PORTADA:", e)
        handler.send_error(500, str(e))


def api_get_covers_index(handler):

    try:

        portadas = {}

        if not filesystem.COVERS.exists():
            handler.send_json(200, {})
            return

        for archivo in filesystem.COVERS.iterdir():

            if (
                not archivo.is_file()
                or archivo.suffix.lower() not in VALID_EXTENSIONS
            ):
                continue

            nombre = archivo.stem
            url_portada = f"/api/get-cover/{quote(nombre, safe='')}"

            # Modelo: audi_a3.jpg
            if "_" in nombre:

                marca, modelo = nombre.split("_", 1)

                if marca not in portadas:
                    portadas[marca] = {
                        "portada": f"/api/get-cover/{quote(marca, safe='')}",
                        "modelos": {}
                    }

                portadas[marca]["modelos"][modelo] = (
                    url_portada
                )

            else:

                marca = nombre

                if marca not in portadas:
                    portadas[marca] = {
                        "portada": url_portada,
                        "modelos": {}
                    }

                else:
                    portadas[marca]["portada"] = url_portada

        handler.send_json(200, portadas)

    except Exception as e:
        print("ERROR OBTENIENDO PORTADAS", e)

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

def api_save_cover(handler):

    try:

        data = handler.read_json()

        tipo = data["tipo"].strip().lower()
        marca = data["marca"].strip().lower()
        modelo = data.get("modelo", "").strip().lower()
        imagen = data["imagen"]

        if tipo not in ("marca", "modelo"):
            raise ValueError("Tipo de portada no válido.")

        if not marca:
            raise ValueError("La marca es obligatoria.")

        if tipo == "modelo" and not modelo:
            raise ValueError("El modelo es obligatorio.")

        # El backend decide el nombre y conserva una extensión permitida.
        if tipo == "marca":
            cover_id = marca
        else:
            cover_id = f"{marca}_{modelo}"

        filesystem.COVERS.mkdir(
            parents=True,
            exist_ok=True
        )

        origen = imagen["origen"]
        valor = imagen["valor"]

        if origen == "base64":
            extension = _cover_extension(
                imagen.get("extension", ""),
                imagen.get("content_type", "")
            )
            contenido = base64.b64decode(valor)

        elif origen == "url":
            req = urllib.request.Request(
                valor,
                headers={
                    "User-Agent": "Mozilla/5.0"
                }
            )

            with urllib.request.urlopen(req) as response:
                extension_url = Path(urlsplit(valor).path).suffix.lower()
                extension = _cover_extension(
                    extension_url,
                    response.headers.get("Content-Type", "")
                )
                contenido = response.read()

        else:
            raise ValueError("Origen de imagen no válido.")

        nombre = f"{cover_id}{extension}"
        ruta_portada = filesystem.COVERS / nombre

        with open(ruta_portada, "wb") as f:
            f.write(contenido)

        for ruta_anterior in _cover_paths(cover_id):
            if ruta_anterior != ruta_portada:
                ruta_anterior.unlink()

        handler.send_json(
            200,
            {
                "ok": True,
                "nombre": nombre
            }
        )

    except Exception as e:

        print("ERROR GUARDANDO PORTADA", e)

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

def api_delete_cover(handler):

    try:

        data = handler.read_json()

        tipo = data["tipo"].strip().lower()
        marca = (data.get("marca") or "").strip().lower()
        modelo = (data.get("modelo") or "").strip().lower()

        if tipo not in ("marca", "modelo"):
            raise ValueError("Tipo de portada no válido.")

        if not marca:
            raise ValueError("La marca es obligatoria.")

        # El mismo criterio utilizado al guardar.
        if tipo == "marca":
            cover_id = marca

        else:

            if not modelo:
                raise ValueError("El modelo es obligatorio.")

            cover_id = f"{marca}_{modelo}"

        rutas = _cover_paths(cover_id)

        if not rutas:

            handler.send_json(
                404,
                {
                    "ok": False,
                    "error": "La portada no existe."
                }
            )

            return

        for ruta_portada in rutas:
            ruta_portada.unlink()

        handler.send_json(
            200,
            {
                "ok": True,
                "nombre": rutas[0].name
            }
        )

    except Exception as e:
        print("ERROR ELIMINANDO PORTADA", e)

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

def _cover_paths(cover_id):

    if not filesystem.COVERS.is_dir():
        return []

    return [
        archivo
        for archivo in filesystem.COVERS.iterdir()
        if (
            archivo.is_file()
            and archivo.stem == cover_id
            and archivo.suffix.lower() in VALID_EXTENSIONS
        )
    ]

def _cover_extension(extension="", content_type=""):

    if isinstance(extension, str):
        extension = extension.lower()

        if extension in VALID_EXTENSIONS:
            return extension

    mime = content_type.split(";", 1)[0].strip().lower()
    mime_extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif"
    }
    extension = (
        mime_extensions.get(mime)
        or (mimetypes.guess_extension(mime) if mime else None)
    )

    if extension == ".jpe":
        extension = ".jpg"

    if extension in VALID_EXTENSIONS:
        return extension

    raise ValueError("La imagen debe tener una extensión permitida.")

#endregion

#region Rename

def api_rename_album_item(handler):
    try:
        data = handler.read_json()
        if not isinstance(data, dict):
            raise ValueError("La petición no es válida.")

        new_name = _album_name(data.get("newName"))
        moves, target_covers = _rename_moves(data, new_name)
        source, destination = moves[0]

        if not source.exists():
            raise FileNotFoundError("El elemento no existe.")

        if source == destination:
            handler.send_json(200, {"ok": True, "newName": new_name})
            return

        conflicts = [
            path for path in [destination, *target_covers]
            if path.exists() and path != source
        ]

        if conflicts and not data.get("overwrite", False):
            handler.send_json(409, {
                "ok": False,
                "conflict": True,
                "error": "Ya existe un elemento con ese nombre."
            })
            return

        for path in conflicts:
            _remove_path(path)

        for source, destination in moves:
            source.rename(destination)
            _update_image_registry_paths([(source, destination)])

        generate_cars_index()
        handler.send_json(200, {"ok": True, "newName": new_name})

    except (ValueError, FileNotFoundError) as error:
        handler.send_json(400, {"ok": False, "error": str(error)})
    except Exception as error:
        print("ERROR RENOMBRANDO ÁLBUM:", error)
        handler.send_json(500, {"ok": False, "error": str(error)})

def _album_name(value):
    if not isinstance(value, str):
        raise ValueError("El nombre no es válido.")

    name = value.strip().lower()
    if (
        not name
        or name in (".", "..")
        or name[-1] in (".", " ")
        or any(char in INVALID_ALBUM_NAME_CHARACTERS or ord(char) < 32 for char in name)
        or name.split(".", 1)[0].upper() in RESERVED_WINDOWS_NAMES
    ):
        raise ValueError("El nombre contiene caracteres no válidos.")

    return name

def _rename_moves(data, new_name):
    item_type = data.get("type")

    if item_type == "image":
        generate_cars_index()
        source = INDEX_IMAGES.get(data.get("imageId"))
        if source is None or not source.is_file():
            raise FileNotFoundError("La imagen no existe.")

        extension = source.suffix
        if Path(new_name).suffix and Path(new_name).suffix.lower() != extension.lower():
            raise ValueError("La imagen debe conservar su extensión original.")

        return [(source, source.with_name(f"{Path(new_name).stem}{extension}"))], []

    brand = _album_name(data.get("brand"))
    if item_type == "brand":
        if brand in ("covers", "index.json") or new_name in ("covers", "index.json"):
            raise ValueError("Ese nombre está reservado por el álbum.")

        source = filesystem.PHOTOS / brand
        covers = _brand_covers(brand)
        moves = [(source, filesystem.PHOTOS / new_name)]
        moves += [
            (cover, filesystem.COVERS / f"{new_name}{cover.stem[len(brand):]}{cover.suffix}")
            for cover in covers
        ]
        return moves, _brand_covers(new_name)

    if item_type == "model":
        model = _album_name(data.get("model"))
        source = filesystem.PHOTOS / brand / model
        covers = _cover_paths(f"{brand}_{model}")
        moves = [(source, filesystem.PHOTOS / brand / new_name)]
        moves += [
            (cover, filesystem.COVERS / f"{brand}_{new_name}{cover.suffix}")
            for cover in covers
        ]
        return moves, _cover_paths(f"{brand}_{new_name}")

    raise ValueError("Tipo de elemento no válido.")

def _brand_covers(brand):
    if not filesystem.COVERS.is_dir():
        return []

    return [
        path for path in filesystem.COVERS.iterdir()
        if path.is_file()
        and path.suffix.lower() in VALID_EXTENSIONS
        and (path.stem == brand or path.stem.startswith(f"{brand}_"))
    ]

def _remove_path(path):
    if path is None:
        return

    resolved = path.resolve()
    targets = (
        filesystem.PHOTOS.resolve(),
        filesystem.COVERS.resolve(),
    )

    inside_photos = False
    for root in targets:
        try:
            resolved.relative_to(root)
            inside_photos = root == filesystem.PHOTOS.resolve()
            break
        except ValueError:
            continue
    else:
        raise ValueError("La ruta no está permitida.")

    if inside_photos:
        _forget_image_path(path)

    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()

#endregion 

#region Folder

def api_create_album_folder(handler):
    try:
        data = handler.read_json()
        if not isinstance(data, dict):
            raise ValueError("La petición no es válida.")

        item_type = str(data.get("type", "")).strip().lower()
        brand = _album_name(data.get("brand")) if data.get("brand") is not None else None
        folder_name = _album_name(data.get("name")) if data.get("name") is not None else None

        if item_type == "brand":
            if not folder_name:
                raise ValueError("La marca es obligatoria.")
            if folder_name in ("covers", "index.json"):
                raise ValueError("Ese nombre está reservado por el álbum.")
            destination = filesystem.PHOTOS / folder_name
            target_covers = _brand_covers(folder_name)

        elif item_type == "model":
            if not brand or not folder_name:
                raise ValueError("La marca y el modelo son obligatorios.")
            if brand in ("covers", "index.json") or folder_name in ("covers", "index.json"):
                raise ValueError("Ese nombre está reservado por el álbum.")

            brand_directory = filesystem.PHOTOS / brand
            if not brand_directory.is_dir():
                raise FileNotFoundError("La marca no existe.")

            destination = filesystem.PHOTOS / brand / folder_name
            target_covers = _cover_paths(f"{brand}_{folder_name}")

        else:
            raise ValueError("Tipo de carpeta no válido.")

        if destination.exists() and not data.get("overwrite", False):
            handler.send_json(409, {
                "ok": False,
                "conflict": True,
                "error": "Ya existe una carpeta con ese nombre."
            })
            return

        if destination.exists() and data.get("overwrite", False):
            for path in [destination, *target_covers]:
                if path.exists():
                    _remove_path(path)

        destination.mkdir(parents=True, exist_ok=True)
        generate_cars_index()
        handler.send_json(200, {"ok": True, "name": destination.name})

    except (ValueError, FileNotFoundError) as error:
        handler.send_json(400, {"ok": False, "error": str(error)})
    except Exception as error:
        print("ERROR CREANDO CARPETA DEL ÁLBUM:", error)
        handler.send_json(500, {"ok": False, "error": str(error)})

def api_delete_album_folder(handler):
    try:
        data = handler.read_json()
        if not isinstance(data, dict):
            raise ValueError("La petición no es válida.")

        item_type = str(data.get("type", "")).strip().lower()
        brand = _album_name(data.get("brand")) if data.get("brand") is not None else None
        model = _album_name(data.get("model")) if data.get("model") is not None else None

        if item_type == "brand":
            if not brand:
                raise ValueError("La marca es obligatoria.")
            if brand in ("covers", "index.json"):
                raise ValueError("Ese nombre está reservado por el álbum.")
            folder = filesystem.PHOTOS / brand
            covers = _brand_covers(brand)

        elif item_type == "model":
            if not brand or not model:
                raise ValueError("La marca y el modelo son obligatorios.")
            if brand in ("covers", "index.json") or model in ("covers", "index.json"):
                raise ValueError("Ese nombre está reservado por el álbum.")
            folder = filesystem.PHOTOS / brand / model
            covers = _cover_paths(f"{brand}_{model}")

        else:
            raise ValueError("Tipo de carpeta no válido.")

        if not folder.exists():
            handler.send_json(404, {
                "ok": False,
                "error": "La carpeta no existe."
            })
            return

        for path in [folder, *covers]:
            if path.exists():
                _remove_path(path)

        generate_cars_index()
        handler.send_json(200, {"ok": True})

    except (ValueError, FileNotFoundError) as error:
        handler.send_json(400, {"ok": False, "error": str(error)})
    except Exception as error:
        print("ERROR ELIMINANDO CARPETA DEL ÁLBUM:", error)
        handler.send_json(500, {"ok": False, "error": str(error)})

#endregion
