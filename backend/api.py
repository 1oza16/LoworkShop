import http.server
import io
import json
import os
import re
from queue import Empty
from backend import sheet
from backend import album
from backend import views
from backend import database
from backend import statistics
from backend import events
from urllib.parse import parse_qsl, unquote, urlencode, urljoin, urlsplit, urlunsplit

class LoworkShopHandler(http.server.SimpleHTTPRequestHandler):
    stream_heartbeat_seconds = 15

    def send_head(self):
        request_path = urlsplit(self.path).path
        if request_path != "/" and not request_path.lower().endswith(".html"):
            return super().send_head()

        if request_path == "/":
            file_path = self.translate_path("index.html")
        else:
            file_path = self.translate_path(request_path)

        try:
            with open(file_path, "rb") as html_file:
                html = html_file.read().decode("utf-8")
        except FileNotFoundError:
            self.send_error(404, "File not found")
            return None

        html = re.sub(
            r"""(?P<prefix>\b(?:href|src)\s*=\s*)(?P<quote>["'])(?P<url>.*?)(?P=quote)""",
            lambda match: (
                match.group("prefix")
                + self._version_static_asset(
                    match.group("url"),
                    request_path
                )
            ),
            html,
            flags=re.IGNORECASE
        )
        body = html.encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(file_path)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        return io.BytesIO(body)

    def _version_static_asset(self, asset_url, html_path):
        parsed_url = urlsplit(asset_url)
        extension = os.path.splitext(parsed_url.path)[1].lower()
        if parsed_url.scheme or parsed_url.netloc or extension not in (".css", ".js"):
            return f'"{asset_url}"'

        asset_path = urlsplit(urljoin(html_path, asset_url)).path
        asset_file = self.translate_path(asset_path)
        if not os.path.isfile(asset_file):
            return f'"{asset_url}"'

        query = [
            (key, value)
            for key, value in parse_qsl(parsed_url.query, keep_blank_values=True)
            if key != "v"
        ]
        query.append(("v", str(os.path.getmtime(asset_file))))
        versioned_url = urlunsplit((
            parsed_url.scheme,
            parsed_url.netloc,
            parsed_url.path,
            urlencode(query),
            parsed_url.fragment
        ))
        return f'"{versioned_url}"'

    def do_GET(self):
        request_path = urlsplit(self.path).path
        if request_path.startswith("/api/stream/"):
            channel = unquote(request_path[len("/api/stream/"):])
            return self._serve_event_stream(channel)
        if request_path == "/api/statistics/data":
            return statistics.api_get_statistics_data(self)
        if request_path == "/api/database/records":
            return database.api_get_records(self)
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
        return self._dispatch_mutation(POST_ENDPOINTS)

    def do_PUT(self):
        return self._dispatch_mutation(PUT_ENDPOINTS)

    def do_DELETE(self):
        return self._dispatch_mutation(DELETE_ENDPOINTS)

    def _dispatch_mutation(self, endpoints):
        route = endpoints.get(self.path)
        if route is None:
            self.send_error(404, "Ruta no encontrada")
            return

        endpoint, channels = route
        self._mutation_channels = channels
        try:
            return endpoint(self)
        finally:
            del self._mutation_channels

    def _serve_event_stream(self, channel):
        if channel not in events.CHANNELS:
            self.send_error(404, "Canal no encontrado")
            return

        subscriber = events.EVENT_MANAGER.subscribe(channel)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    event_name = subscriber.get(
                        timeout=self.stream_heartbeat_seconds
                    )
                    message = f"event: {event_name}\ndata: {{}}\n\n"
                except Empty:
                    message = ": keep-alive\n\n"

                self.wfile.write(message.encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
        finally:
            events.EVENT_MANAGER.unsubscribe(channel, subscriber)

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
        if 200 <= code < 300:
            for channel in getattr(self, "_mutation_channels", ()):
                events.EVENT_MANAGER.notify(channel)

    def read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        data = self.rfile.read(content_length)
        return json.loads(data)
    
    def log_message(self, format, *args):
        pass

SHEET_CHANNELS = ("sheets", "database", "statistics")
DATABASE_CHANNELS = ("database", "statistics")
ALBUM_CHANNELS = ("album",)


# Diccionario con los endpoints
GET_ENDPOINTS = {
        "/api/get-cars-index": album.api_get_cars_index,
        "/api/get-covers-index": album.api_get_covers_index,
        "/api/list-sheets": sheet.api_list_sheets,
        "/api/database/tables": database.api_get_tables,
    }

POST_ENDPOINTS = {
        "/api/create-sheet": (sheet.api_create_sheet, SHEET_CHANNELS),
        "/api/save-sheet": (sheet.api_save_sheet, SHEET_CHANNELS),
        "/api/update-sheet-metadata": (sheet.api_update_sheet_metadata, SHEET_CHANNELS),
        "/api/delete-sheet": (sheet.api_delete_sheet, SHEET_CHANNELS),
        "/api/save-photo": (album.api_save_photo, ALBUM_CHANNELS),
        "/api/delete-image": (album.api_delete_image, ALBUM_CHANNELS),
        "/api/create-album-folder": (album.api_create_album_folder, ALBUM_CHANNELS),
        "/api/database/record": (database.api_create_record, DATABASE_CHANNELS),
    }

PUT_ENDPOINTS = {
        "/api/save-cover": (album.api_save_cover, ALBUM_CHANNELS),
        "/api/rename-album-item": (album.api_rename_album_item, ALBUM_CHANNELS),
        "/api/database/record": (database.api_update_record, DATABASE_CHANNELS),
    }

DELETE_ENDPOINTS = {
        "/api/delete-cover": (album.api_delete_cover, ALBUM_CHANNELS),
        "/api/delete-album-folder": (album.api_delete_album_folder, ALBUM_CHANNELS),
        "/api/database/record": (database.api_delete_record, DATABASE_CHANNELS),
    }