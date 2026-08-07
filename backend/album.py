from core import filesystem
import json
import base64
import urllib
import hashlib
import mimetypes

INDEX = filesystem.PHOTOS / "index.json"
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
INDEX_IMAGES = {}

# Devuelve el catálogo de vehículos.
def api_coches(handler):

    try:

        ruta_json = INDEX

        if not ruta_json.is_file():
            generar_indice_coches()

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

        print(
            "ERROR CARGANDO INDEX:",
            e
        )
        
        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

def api_retornar_imagen(handler):

    image_id = handler.path.removeprefix("/api/retornar-imagen/")

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

        print(
            "ERROR ENVIANDO IMAGEN:",
            e
        )

        handler.send_error(
            500,
            str(e)
        )

def api_eliminar_imagen(handler):

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

        ruta.unlink()

        generar_indice_coches()

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
    
# Guarda las imagenes locales en la biblioteca de vehículos (fotos_coches).
def api_subir_foto(handler):

    try:

        data = handler.read_json()

        marca = data["marca"].strip().lower()
        modelo = data["modelo"].strip().lower()
        nombre = data["nombreFinal"].strip()
        imagen_base64 = data["base64"]

        carpeta_destino = filesystem.PHOTOS / marca / modelo

        carpeta_destino.mkdir(parents=True, exist_ok=True)

        ruta_archivo = carpeta_destino / nombre

        with open(
            ruta_archivo,
            "wb"
        ) as f:

            f.write(
                base64.b64decode(
                    imagen_base64
                )
            )

        resultado = generar_indice_coches()

        
        handler.send_json(
            200,
            {
                "ok": True,
                "archivo": str(ruta_archivo),
                "indice": resultado
            }
        )

    except Exception as e:

        print(
            "ERROR GUARDANDO IMAGEN LOCAL:",
            e
        )
        
        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

# Guarda las imagenes por url en la biblioteca de vehículos (fotos_coches).
def api_guardar_url(handler):

    try:

        data = handler.read_json()

        marca = data["marca"].strip().lower()
        modelo = data["modelo"].strip().lower()
        nombre = data["nombreFinal"].strip()
        url = data["imagenPendiente"].strip()

        carpeta_destino = filesystem.PHOTOS / marca / modelo

        carpeta_destino.mkdir(parents=True, exist_ok=True)

        ruta_archivo = carpeta_destino / nombre

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent":
                "Mozilla/5.0"
            }
        )
        
        with urllib.request.urlopen(req) as response:
        
            with open(
                ruta_archivo,
                "wb"
            ) as f:
        
                f.write(
                    response.read()
                )

        resultado = generar_indice_coches()

        handler.send_json(
            200,
            {
                "ok": True,
                "archivo": str(ruta_archivo),
                "indice": resultado
            }
        )

    except Exception as e:

        print(
            "ERROR GUARDANDO IMAGEN URL:",
            e
        )
        
        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

# Escanea fotos_coches/marca/modelo/imagen.ext y genera fotos_coches/index.json. Devuelve un dict con el resultado (para poder informar al front-end).
def generar_indice_coches():

    indice = {}

    if not filesystem.PHOTOS.is_dir():
        filesystem.PHOTOS.mkdir(
            parents=True,
            exist_ok=True
        )

    for ruta_marca in filesystem.PHOTOS.iterdir():

        if not ruta_marca.is_dir():
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
                    imagen_id = generar_id_imagen(marca, modelo, nombre)

                    INDEX_IMAGES[imagen_id] = ruta_imagen

                    imagenes.append({
                        "id": imagen_id,
                        "nombre": nombre
                    })

            # if imagenes:
            modelos[modelo] = imagenes

        # if modelos:
        indice[marca] = modelos

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

def generar_id_imagen(brand, model, name):

    texto = f"{brand}/{model}/{name}"

    return hashlib.sha1(
        texto.encode("utf-8")
    ).hexdigest()[:8]