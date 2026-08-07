from core import filesystem
from bs4 import BeautifulSoup
from .album import INDEX_IMAGES

#  Guarda las hojas informativas en .html una vez finalizadas para poder modificarlas de nuevo (notas) y genera un .pdf con la información de la hoja (pdf).
def api_guardar_hoja(handler):

    try:
        data = handler.read_json()
        
        name = data["nombre"]
        html = data["html"]
        htmlPDF = data["htmlPDF"]

        soup = BeautifulSoup(htmlPDF, "html.parser")
        
        for img in soup.select("img[data-image-id]"):
            image_id = img.get("data-image-id")
            ruta = INDEX_IMAGES.get(image_id)

            if ruta is not None:
                img["src"] = ruta.resolve().as_uri()
        
        htmlPDF = str(soup)

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