from core import filesystem, discovery
from backend import album, api
import os
import webbrowser
import http.server
import socketserver
import threading

# Entrada a la carpeta del proyecto
os.chdir(filesystem.ROOT)

PORT = 8000


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def iniciar_servidor():
    with ThreadingHTTPServer(("", PORT), api.LoworkShopHandler) as httpd:
        print(f"Servidor HTTP iniciado en http://localhost:{PORT}")
        print(f"Accesible desde la red local en http://0.0.0.0:{PORT}")
        httpd.serve_forever()


def iniciar_descubrimiento():
    udp_server = discovery.start_discovery_server(http_port=PORT)
    print(f"Descubrimiento UDP activo en udp://0.0.0.0:{discovery.DISCOVERY_PORT}")
    udp_server.serve_forever()


if __name__ == "__main__":
    album.generate_cars_index()

    threading.Thread(target=iniciar_servidor, daemon=True).start()
    threading.Thread(target=iniciar_descubrimiento, daemon=True).start()

    webbrowser.open(f"http://localhost:{PORT}")
    input("LoworkShop en ejecución. Pulsa ENTER para cerrar...\n")