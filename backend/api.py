import http.server
import json
from backend import sheet
from backend import album
from backend import views

class LoworkShopHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path.startswith("/api/get-sheet/"):
            return sheet.api_get_sheet(self)
        if self.path.startswith("/api/get-image/"):
            return album.api_get_image(self)
        if self.path.startswith("/api/get-cover/"):
            return album.api_get_cover(self)
        if self.path.startswith("/api/get-view/"):
            return views.api_get_view(self)
        
    
        endpoint = GET_ENDPOINTS.get(self.path)

        if endpoint:
            return endpoint(self)
        
        return super().do_GET()

    def do_POST(self):
        endpoint = POST_ENDPOINTS.get(self.path)

        if endpoint:
            return endpoint(self)
        
        self.send_error(404, "Ruta no encontrada")

    def do_PUT(self):
        endpoint = PUT_ENDPOINTS.get(self.path)
        if endpoint:
            return endpoint(self)
        self.send_error(404, "Ruta no encontrada")

    def do_DELETE(self):
        endpoint = DELETE_ENDPOINTS.get(self.path)
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
        "/api/get-cars-index": album.api_get_cars_index,
        "/api/get-covers-index": album.api_get_covers_index,
        "/api/list-sheets": sheet.api_list_sheets,
    }

POST_ENDPOINTS = {
        "/api/create-sheet": sheet.api_create_sheet,
        "/api/save-sheet": sheet.api_save_sheet,
        "/api/delete-sheet": sheet.api_delete_sheet,
        "/api/save-photo": album.api_save_photo,
        "/api/delete-image": album.api_delete_image,
        "/api/create-album-folder": album.api_create_album_folder,
    }

PUT_ENDPOINTS = {
        "/api/save-cover": album.api_save_cover,
        "/api/rename-album-item": album.api_rename_album_item,
    }

DELETE_ENDPOINTS = {
        "/api/delete-cover": album.api_delete_cover,
        "/api/delete-album-folder": album.api_delete_album_folder,
    }