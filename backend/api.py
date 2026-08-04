import http.server
import json
from backend import sheet
from backend import album

class LoworkShopHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        endpoint = GET_ENDPOINTS.get(self.path)

        if endpoint:
            return endpoint(self)
        
        return super().do_GET()

    def do_POST(self):
        endpoint = POST_ENDPOINTS.get(self.path)

        if endpoint:
            return endpoint(self)
        
        self.send_error(404, "Ruta no encontrada")

    # Herramientas JSON
    def send_json(self, code, data):

        body = json.dumps(
            data,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(code)
        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )
        self.send_header(
            "Content-Length",
            str(len(body))
        )
        self.end_headers()

        self.wfile.write(body)

    def read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(content_length)
        return json.loads(data)
    
    def log_message(self, format, *args):
        pass

# Diccionario con los endpoints
GET_ENDPOINTS = {
        "/api/coches": album.api_coches,
    }

POST_ENDPOINTS = {
        "/api/guardar-hoja": sheet.api_guardar_hoja,
        "/api/subir-foto": album.api_subir_foto,
        "/api/guardar-url": album.api_guardar_url,
    }