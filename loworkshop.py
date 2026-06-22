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
EXTENSIONES_VALIDAS = {".jpg", ".jpeg", ".png", ".webp" }


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


class LoworkShopHandler(http.server.SimpleHTTPRequestHandler):
    """
    Extiende el servidor estático con un endpoint para regenerar
    el índice de la biblioteca de vehículos sin salir del navegador.
    """

    def do_POST(self):
        if self.path == "/api/regenerar-indice":
            try:
                resultado = generar_indice_coches()
                self._responder_json(200, resultado)
            except Exception as e:
                self._responder_json(500, {"ok": False, "error": str(e)})
        else:
            self.send_error(404, "Ruta no encontrada")

    def _responder_json(self, codigo, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def log_message(self, format, *args):
        # Mantiene la consola limpia; comenta esta línea si quieres ver
        # todas las peticiones HTTP en detalle.
        pass

def iniciar_servidor():
    Handler = http.server.SimpleHTTPRequestHandler

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