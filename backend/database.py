import sqlite3
from uuid import uuid4
from urllib.parse import parse_qs, urlsplit
from core import filesystem

DATABASE_PATH = filesystem.ROOT / "database" / "loworkshop.db"

record_queries = {
    "modelos": """
        SELECT modelos.*, marcas.nombre AS nombre_marca
        FROM modelos
        LEFT JOIN marcas ON marcas.uuid = modelos.marca_uuid
    """,
    "fichas": """
        SELECT
            fichas.*,
            clientes.nombre AS nombre_cliente,
            modelos.nombre AS nombre_modelo
        FROM fichas
        LEFT JOIN clientes ON clientes.uuid = fichas.cliente_uuid
        LEFT JOIN modelos ON modelos.uuid = fichas.modelo_uuid
    """
}


def connect():
    if not DATABASE_PATH.is_file():
        raise FileNotFoundError(
            f"No se encontró la base de datos: {DATABASE_PATH}"
        )

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(fichas)")
        }
        if "matricula" not in columns:
            connection.execute("ALTER TABLE fichas ADD COLUMN matricula TEXT")
        if "nombre_ficha" not in columns:
            connection.execute("ALTER TABLE fichas ADD COLUMN nombre_ficha TEXT")
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS fichas_nombre_ficha_unique
            ON fichas(nombre_ficha)
            """
        )
        connection.commit()
        return connection
    except Exception:
        connection.rollback()
        connection.close()
        raise


def _quote_identifier(name):
    return '"' + name.replace('"', '""') + '"'


def _get_table_schema(connection, table_name):
    table = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        (table_name,)
    ).fetchone()

    if not table or table_name.startswith("sqlite_"):
        raise ValueError("La tabla indicada no existe.")

    rows = connection.execute(
        f"PRAGMA table_info({_quote_identifier(table_name)})"
    ).fetchall()

    return [
        {
            "name": row["name"],
            "type": row["type"],
            "primaryKey": row["pk"] > 0,
            "notNull": bool(row["notnull"]),
            "default": row["dflt_value"]
        }
        for row in rows
    ]


def get_tables():
    connection = connect()

    try:
        tables = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
            """
        ).fetchall()

        result = []
        for row in tables:
            name = row["name"]
            if name.startswith("sqlite_"):
                continue

            count = connection.execute(
                f"SELECT COUNT(*) FROM {_quote_identifier(name)}"
            ).fetchone()[0]
            result.append({
                "name": name,
                "count": count
            })

        return result
    finally:
        connection.close()


def get_table_schema(table_name):
    connection = connect()

    try:
        return _get_table_schema(connection, table_name)
    finally:
        connection.close()


def get_table_records(table_name):
    connection = connect()

    try:
        columns = _get_table_schema(connection, table_name)
        query = record_queries.get(
            table_name,
            f"SELECT * FROM {_quote_identifier(table_name)}"
        )
        records = connection.execute(query).fetchall()

        return {
            "columns": columns,
            "records": [dict(record) for record in records]
        }
    finally:
        connection.close()


def _validate_record_data(schema, record_data):
    if not isinstance(record_data, dict):
        raise ValueError("Los datos del registro no son válidos.")

    columns = {column["name"] for column in schema}
    unknown_columns = set(record_data) - columns
    if unknown_columns:
        raise ValueError("El registro contiene columnas no válidas.")


def create_record(table_name, record_data):
    connection = connect()

    try:
        schema = _get_table_schema(connection, table_name)
        _validate_record_data(schema, record_data)
        data = dict(record_data)

        if any(column["name"] == "uuid" for column in schema):
            if not data.get("uuid"):
                data["uuid"] = str(uuid4())

        if not data:
            raise ValueError("No se han indicado datos para el registro.")

        columns = list(data)
        column_names = ", ".join(
            _quote_identifier(column) for column in columns
        )
        placeholders = ", ".join("?" for _ in columns)
        connection.execute(
            f"""
            INSERT INTO {_quote_identifier(table_name)}
                ({column_names})
            VALUES ({placeholders})
            """,
            [data[column] for column in columns]
        )
        connection.commit()
    finally:
        connection.close()


def _get_primary_key(schema, pk_column):
    primary_keys = [
        column["name"]
        for column in schema
        if column["primaryKey"]
    ]

    if len(primary_keys) != 1 or pk_column != primary_keys[0]:
        raise ValueError("La clave primaria indicada no es válida.")

    return primary_keys[0]


def update_record(table_name, pk_col, pk_value, record_data):
    connection = connect()

    try:
        schema = _get_table_schema(connection, table_name)
        pk_column = _get_primary_key(schema, pk_col)
        _validate_record_data(schema, record_data)

        if not record_data:
            raise ValueError("No se han indicado cambios para el registro.")

        assignments = ", ".join(
            f"{_quote_identifier(column)} = ?"
            for column in record_data
        )
        cursor = connection.execute(
            f"""
            UPDATE {_quote_identifier(table_name)}
            SET {assignments}
            WHERE {_quote_identifier(pk_column)} = ?
            """,
            [*record_data.values(), pk_value]
        )
        connection.commit()

        if cursor.rowcount == 0:
            return False

        return True
    finally:
        connection.close()


def delete_record(table_name, pk_col, pk_value):
    connection = connect()

    try:
        schema = _get_table_schema(connection, table_name)
        pk_column = _get_primary_key(schema, pk_col)
        cursor = connection.execute(
            f"""
            DELETE FROM {_quote_identifier(table_name)}
            WHERE {_quote_identifier(pk_column)} = ?
            """,
            (pk_value,)
        )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()


def _read_json(handler):
    data = handler.read_json()
    if not isinstance(data, dict):
        raise ValueError("El cuerpo de la solicitud no es válido.")
    return data


def _send_database_error(handler, error, action):
    if isinstance(error, ValueError):
        return handler.send_json(
            400,
            {"ok": False, "error": str(error)}
        )

    if isinstance(error, sqlite3.IntegrityError):
        return handler.send_json(
            409,
            {
                "ok": False,
                "conflict": True,
                "error": (
                    "No se puede completar la operación por una "
                    "restricción de integridad."
                )
            }
        )

    print(f"ERROR {action} REGISTRO DE BASE DE DATOS:", error)
    return handler.send_json(
        500,
        {
            "ok": False,
            "error": f"No se pudo completar la operación: {action}."
        }
    )


def api_get_tables(handler):
    try:
        return handler.send_json(
            200,
            {"tables": get_tables()}
        )
    except (ValueError, sqlite3.Error, OSError) as error:
        return _send_database_error(handler, error, "listar tablas")


def api_get_records(handler):
    try:
        table_values = parse_qs(urlsplit(handler.path).query).get("table")
        if not table_values or not table_values[0]:
            raise ValueError("Falta indicar la tabla.")

        table_name = table_values[0]
        result = get_table_records(table_name)
        return handler.send_json(
            200,
            {
                "table": table_name,
                **result
            }
        )
    except (ValueError, sqlite3.Error, OSError) as error:
        return _send_database_error(handler, error, "consultar")


def api_create_record(handler):
    try:
        data = _read_json(handler)
        table_name = data.get("table")
        if not isinstance(table_name, str) or not table_name:
            raise ValueError("Falta indicar la tabla.")

        create_record(table_name, data.get("data"))
        return handler.send_json(200, {"ok": True})
    except (ValueError, sqlite3.Error, OSError) as error:
        return _send_database_error(handler, error, "crear")


def api_update_record(handler):
    try:
        data = _read_json(handler)
        table_name = data.get("table")
        if not isinstance(table_name, str) or not table_name:
            raise ValueError("Falta indicar la tabla.")

        updated = update_record(
            table_name,
            data.get("pkCol"),
            data.get("pkValue"),
            data.get("data")
        )
        if not updated:
            return handler.send_json(
                404,
                {"ok": False, "error": "El registro no existe."}
            )

        return handler.send_json(200, {"ok": True})
    except (ValueError, sqlite3.Error, OSError) as error:
        return _send_database_error(handler, error, "actualizar")


def api_delete_record(handler):
    try:
        data = _read_json(handler)
        table_name = data.get("table")
        if not isinstance(table_name, str) or not table_name:
            raise ValueError("Falta indicar la tabla.")

        deleted = delete_record(
            table_name,
            data.get("pkCol"),
            data.get("pkValue")
        )
        if not deleted:
            return handler.send_json(
                404,
                {"ok": False, "error": "El registro no existe."}
            )

        return handler.send_json(200, {"ok": True})
    except (ValueError, sqlite3.Error, OSError) as error:
        return _send_database_error(handler, error, "eliminar")