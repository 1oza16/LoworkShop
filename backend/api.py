import http.server
import json
from backend import sheet
from backend import album
from backend import views

class LoworkShopHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path.startswith("/api/retornar-hoja/"):
            return sheet.api_retornar_hoja(self)
        if self.path.startswith("/api/retornar-imagen/"):
            return album.api_retornar_imagen(self)
        if self.path.startswith("/api/retornar-view/"):
            return views.api_retornar_view(self)
        
    
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
        "/api/listar-hojas": sheet.api_listar_hojas,
    }

POST_ENDPOINTS = {
        "/api/crear-hoja": sheet.api_crear_hoja,
        "/api/guardar-hoja": sheet.api_guardar_hoja,
        "/api/eliminar-hoja": sheet.api_eliminar_hoja,
        "/api/subir-foto": album.api_subir_foto,
        "/api/guardar-url": album.api_guardar_url,
        "/api/eliminar-imagen": album.api_eliminar_imagen,
    }