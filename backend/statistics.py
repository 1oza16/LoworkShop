import sqlite3
from . import database


def get_statistics_data():
    connection = database.connect()

    try:
        records = connection.execute(
            """
            SELECT
                fichas.uuid,
                fichas.cliente_uuid,
                clientes.nombre AS cliente,
                fichas.modelo_uuid,
                modelos.nombre AS modelo,
                modelos.marca_uuid,
                marcas.nombre AS marca,
                fichas.fecha,
                fichas.kilometraje,
                fichas.matricula
            FROM fichas
            LEFT JOIN clientes ON clientes.uuid = fichas.cliente_uuid
            LEFT JOIN modelos ON modelos.uuid = fichas.modelo_uuid
            LEFT JOIN marcas ON marcas.uuid = modelos.marca_uuid
            """
        ).fetchall()

        return [dict(record) for record in records]
    finally:
        connection.close()


def api_get_statistics_data(handler):
    try:
        return handler.send_json(
            200,
            {"records": get_statistics_data()}
        )
    except (sqlite3.Error, OSError) as error:
        print("ERROR CARGANDO ESTADÍSTICAS:", error)
        return handler.send_json(
            500,
            {"error": "No se pudieron cargar las estadísticas."}
        )