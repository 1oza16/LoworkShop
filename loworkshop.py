import os
import sys
import webbrowser
import http.server
import socketserver
import threading
import webbrowser

# Carpeta raíz del proyecto y puerto
if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
else:
    ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000

# Entrar en la carpeta del proyecto
os.chdir(ROOT)

def iniciar_servidor():
    Handler = http.server.SimpleHTTPRequestHandler

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Servidor iniciado en http://localhost:{PORT}")
        httpd.serve_forever()

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