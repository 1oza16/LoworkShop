from core import filesystem

def api_get_view(handler):

    nombre_vista = handler.path.removeprefix("/api/get-view/")

    ruta_vista = filesystem.VIEWS / f"{nombre_vista}.html"

    if not ruta_vista.is_file():
        return handler.send_error(
            404,
            "Vista no encontrada"
        )

    try:
        with open(ruta_vista, "r", encoding="utf-8") as f:
            html = f.read()

        contenido = html.encode("utf-8")

        handler.send_response(200)
        handler.send_header(
            "Content-Type",
            "text/html; charset=utf-8"
        )
        handler.send_header(
            "Content-Length",
            str(len(contenido))
        )
        handler.end_headers()

        handler.wfile.write(contenido)

    except Exception as e:

        print("ERROR CARGANDO VISTA:", e)

        handler.send_error(
            500,
            "Error al cargar la vista"
        )