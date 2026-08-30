from core import filesystem
from backend import album, api
import os
import webbrowser
import socketserver
import threading

# Entrada a la carpeta del proyecto
os.chdir(filesystem.ROOT)

PORT = 8000

def iniciar_servidor():

    with socketserver.TCPServer(("", PORT), api.LoworkShopHandler) as httpd:
        print(f"Servidor iniciado en http://localhost:{PORT}")
        httpd.serve_forever()

# Generacion del json
album.generar_indice_coches()

# Servidor en segundo plano
threading.Thread(
    target=iniciar_servidor,
    daemon=True
).start()

# Abrir navegador por defecto de google
webbrowser.open(
    "http://localhost:8000"
)

input("LoworkShop en ejecución. Pulsa ENTER para cerrar...\n")