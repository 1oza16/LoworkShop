from core import filesystem

#  Guarda las hojas informativas en .html una vez finalizadas para poder modificarlas de nuevo (notas) y genera un .pdf con la información de la hoja (pdf).
def api_guardar_hoja(handler):

    try:
        data = handler.read_json()
        
        name = data["nombre"]
        html = data["html"]
        htmlPDF = data["htmlPDF"]

        ruta_html = filesystem.NOTES/ f"{name}.html"

        if not ruta_html.is_file():

            raise Exception(
                f"No existe la hoja: {ruta_html}"
            )

        with ruta_html.open(
            "w",
            encoding="utf-8"
        ) as f:

            f.write(html)

        ruta_pdf = filesystem.PDF / f"{name}.pdf"

        from weasyprint import HTML

        HTML(
            string=htmlPDF,
            base_url=ruta_html.parent
        ).write_pdf(ruta_pdf)

        handler.send_json(
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

        handler.send_json(
            500,
            {
                "ok": False,
                "error": str(e)
            }
        )