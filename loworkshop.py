import os
import sys
import webbrowser
import http.server
import json
import socketserver
import threading
import base64
import urllib.request

# Carpeta raíz del proyecto y puerto
if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
else:
    ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000

# Entrada a la carpeta del proyecto
os.chdir(ROOT)

# Carpeta con fotos de vehiculos trabajados y extensiones admitidas
CARPETA_FOTOS = "fotos_coches"
EXTENSIONES_VALIDAS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def generar_indice_coches():
    """
    Escanea fotos_coches/marca/modelo/imagen.ext y genera fotos_coches/index.json.
    Devuelve un dict con el resultado (para poder informar al front-end).
    """
    indice = {}

    if not os.path.isdir(CARPETA_FOTOS):
        os.makedirs(CARPETA_FOTOS, exist_ok=True)

    for marca in sorted(os.listdir(CARPETA_FOTOS)):
        ruta_marca = os.path.join(CARPETA_FOTOS, marca)
        if not os.path.isdir(ruta_marca):
            continue

        modelos = {}
        for modelo in sorted(os.listdir(ruta_marca)):
            ruta_modelo = os.path.join(ruta_marca, modelo)
            if not os.path.isdir(ruta_modelo):
                continue

            imagenes = sorted(
                f for f in os.listdir(ruta_modelo)
                if os.path.splitext(f)[1].lower() in EXTENSIONES_VALIDAS
            )
            if imagenes:
                modelos[modelo] = imagenes

        if modelos:
            indice[marca] = modelos

    ruta_salida = os.path.join(CARPETA_FOTOS, "index.json")
    with open(ruta_salida, "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)

    total_marcas = len(indice)
    total_modelos = sum(len(m) for m in indice.values())
    total_imagenes = sum(len(imgs) for m in indice.values() for imgs in m.values())

    return {
        "ok": True,
        "marcas": total_marcas,
        "modelos": total_modelos,
        "imagenes": total_imagenes,
    }

# Clase LoworkShopHandler con las llamadas
class LoworkShopHandler(http.server.SimpleHTTPRequestHandler):
    """
    API LoworkShop

    GET
    ----
    /api/coches
        Devuelve el catálogo de vehículos.

    POST
    ----

    /api/subir-foto
        Guarda las imagenes locales en la biblioteca de vehículos (fotos_coches).

    /api/guardar-url
        Guarda las imagenes por url en la biblioteca de vehículos (fotos_coches).

    /api/guardar-hoja
        Guarda las hojas informativas en .html una vez finalizadas para poder modificarlas de nuevo (notas) y genera un .pdf con la información de la hoja (pdf).
    """


    # Endpoints GET

    def do_GET(self):

        # Devuelve el catálogo de vehículos
        if self.path == "/api/coches":
            return self.api_coches()

        return super().do_GET()


    # Endpoints POST

    def do_POST(self):

        # Subir imagen local
        if self.path == "/api/subir-foto":
            return self.api_subir_foto()

        # Descargar imagen desde URL
        if self.path == "/api/guardar-url":
            return self.api_guardar_url()

        # Guardar hoja informativa
        if self.path == "/api/guardar-hoja":
            return self.api_guardar_hoja()

        self.send_error(404, "Ruta no encontrada")


    # API: catálogo de vehículos

    def api_coches(self):

        try:

            ruta_json = os.path.join(
                CARPETA_FOTOS,
                "index.json"
            )

            if not os.path.exists(ruta_json):
                generar_indice_coches()

            with open(
                ruta_json,
                "r",
                encoding="utf-8"
            ) as f:

                datos = json.load(f)

            self._responder_json(
                200,
                datos
            )

        except Exception as e:

            self._responder_json(
                500,
                {
                    "ok": False,
                    "error": str(e)
                }
            )


    # API: subir imagen local

    def api_subir_foto(self):

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(body)

            marca = data["marca"].strip().lower()
            modelo = data["modelo"].strip().lower()
            nombre = data["nombre"].strip()

            imagen_base64 = data["imagen"]

            carpeta_destino = os.path.join(
                CARPETA_FOTOS,
                marca,
                modelo
            )

            os.makedirs(
                carpeta_destino,
                exist_ok=True
            )

            ruta_archivo = os.path.join(
                carpeta_destino,
                nombre
            )

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

            self._responder_json(
                200,
                {
                    "ok": True,
                    "archivo": ruta_archivo,
                    "indice": resultado
                }
            )

        except Exception as e:

            self._responder_json(
                500,
                {
                    "ok": False,
                    "error": str(e)
                }
            )


    # API: guardar imagen desde URL

    def api_guardar_url(self):

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(body)

            marca = data["marca"].strip().lower()
            modelo = data["modelo"].strip().lower()
            nombre = data["nombre"].strip()
            url = data["url"].strip()

            carpeta_destino = os.path.join(
                CARPETA_FOTOS,
                marca,
                modelo
            )

            os.makedirs(
                carpeta_destino,
                exist_ok=True
            )

            ruta_archivo = os.path.join(
                carpeta_destino,
                nombre
            )

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

            self._responder_json(
                200,
                {
                    "ok": True,
                    "archivo": ruta_archivo,
                    "indice": resultado
                }
            )

        except Exception as e:

            self._responder_json(
                500,
                {
                    "ok": False,
                    "error": str(e)
                }
            )

    # API: guardar hoja informativa

    def api_guardar_hoja(self):

        try:

            content_length = int(
                self.headers.get(
                    "Content-Length",
                    0
                )
            )

            body = self.rfile.read(
                content_length
            )

            data = json.loads(body)

            ruta = data["ruta"]
            html = data["html"]
            htmlPDF = data["htmlPDF"]

            ruta_relativa = ruta.lstrip("/")

            ruta_fichero = os.path.join(
                ROOT,
                ruta_relativa
            )

            if not os.path.isfile(
                ruta_fichero
            ):

                raise Exception(
                    f"No existe la hoja: {ruta_fichero}"
                )

            with open(
                ruta_fichero,
                "w",
                encoding="utf-8"
            ) as f:

                f.write(html)
            
            nombre_pdf = (
                os.path.splitext(
                    os.path.basename(
                        ruta_fichero
                    )
                )[0]
                + ".pdf"
            )

            ruta_pdf = os.path.join(
                ROOT,
                "pdf",
                nombre_pdf
            )

            from weasyprint import HTML

            HTML(
                string=htmlPDF,
                base_url=os.path.dirname(ruta_fichero)
            ).write_pdf(ruta_pdf)

            self._responder_json(
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

            self._responder_json(
                500,
                {
                    "ok": False,
                    "error": str(e)
                }
            )

    # Utilidad JSON

    def _responder_json(self, codigo, datos):

        cuerpo = json.dumps(
            datos,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(codigo)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )
        self.send_header(
            "Content-Length",
            str(len(cuerpo))
        )
        self.end_headers()

        self.wfile.write(cuerpo)

    def log_message(self, format, *args):
        pass

def iniciar_servidor():
    Handler = LoworkShopHandler

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor iniciado en http://localhost:{PORT}")
        httpd.serve_forever()

# Generacion del json
generar_indice_coches()

# Servidor en segundo plano
threading.Thread(
    target=iniciar_servidor,
    daemon=True
).start()

# Abrir navegador por defecto de google
chrome_path = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe"
)

webbrowser.register(
    'chrome',
    None,
    webbrowser.BackgroundBrowser(chrome_path)
)

webbrowser.get('chrome').open(
    "http://localhost:8000"
)

input("LoworkShop en ejecución. Pulsa ENTER para cerrar...\n")