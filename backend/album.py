from core import filesystem
import os
import json
import base64
import urllib

INDEX = filesystem.PHOTOS / "index.json"
VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

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
                "archivo": ruta_archivo,
                "indice": resultado
            }
        )

    except Exception as e:

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
                "archivo": ruta_archivo,
                "indice": resultado
            }
        )

    except Exception as e:

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )

# Escanea fotos_coches/marca/modelo/imagen.ext y genera fotos_coches/index.json. Devuelve un dict con el resultado (para poder informar al front-end).
# def generar_indice_coches():
#     indice = {}

#     if not filesystem.PHOTOS.is_file():
#         filesystem.PHOTOS.mkdir(parents=True, exist_ok=True)

#     for marca in sorted(filesystem.PHOTOS.iterdir()):
#         ruta_marca = filesystem.PHOTOS / marca
#         if not ruta_marca.is_dir():
#             continue

#         modelos = {}
#         for modelo in sorted(ruta_marca.iterdir()):
#             ruta_modelo = ruta_marca / modelo
#             if not ruta_modelo.is_dir():
#                 continue

#             imagenes = sorted(
#                 f for f in ruta_modelo.iterdir()
#                 if os.path.splitext(f)[1].lower() in VALID_EXTENSIONS
#             )
#             if imagenes:
#                 modelos[modelo] = imagenes

#         if modelos: 
#             indice[marca] = modelos

#     ruta_salida = INDEX
#     with open(ruta_salida, "w", encoding="utf-8") as f:
#         json.dump(indice, f, ensure_ascii=False, indent=2)

#     total_marcas = len(indice)
#     total_modelos = sum(len(m) for m in indice.values())
#     total_imagenes = sum(len(imgs) for m in indice.values() for imgs in m.values())

#     return {
#         "ok": True,
#         "marcas": total_marcas,
#         "modelos": total_modelos,
#         "imagenes": total_imagenes,
#     }

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
                    imagenes.append(ruta_imagen.name)

            if imagenes:
                modelos[modelo] = imagenes

        if modelos:
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