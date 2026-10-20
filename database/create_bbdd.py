import sqlite3

RUTA_BBDD = "loworkshop.db"


def crear_tablas():
    conexion = sqlite3.connect(RUTA_BBDD)
    conexion.execute("PRAGMA foreign_keys = ON")

    try:
        cursor = conexion.cursor()

        # 1. Tabla clientes
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clientes (
                uuid TEXT PRIMARY KEY,
                nombre TEXT NOT NULL
            )
        """)

        # 2. Tabla marcas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS marcas (
                uuid TEXT PRIMARY KEY,
                nombre TEXT NOT NULL UNIQUE
            )
        """)

        # 3. Tabla modelos
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS modelos (
                uuid TEXT PRIMARY KEY,
                marca_uuid TEXT NOT NULL,
                nombre TEXT NOT NULL,

                FOREIGN KEY (marca_uuid)
                    REFERENCES marcas(uuid),

                UNIQUE (marca_uuid, nombre)
            )
        """)

        # 4. Tabla fichas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fichas (
                uuid TEXT PRIMARY KEY,
                cliente_uuid TEXT NOT NULL,
                modelo_uuid TEXT NOT NULL,
                kilometraje INTEGER,
                fecha DATE,
                matricula TEXT,
                nombre_ficha TEXT UNIQUE

                FOREIGN KEY (cliente_uuid)
                    REFERENCES clientes(uuid),

                FOREIGN KEY (modelo_uuid)
                    REFERENCES modelos(uuid)
            )
        """)

        conexion.commit()
        print("Tablas loworkshop creadas correctamente.")

    except sqlite3.Error as error:
        conexion.rollback()
        print(f"Error al crear las tablas: {error}")
        raise

    finally:
        conexion.close()


if __name__ == "__main__":
    crear_tablas()