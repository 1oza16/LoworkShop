![Logo](/img/isologo.png)

# LoworkShop

LoworkShop es una aplicación local orientada a la gestión y documentación de reparaciones de vehículos mediante fichas de trabajo en formato HTML.

El proyecto está diseñado para funcionar completamente en local, sin bases de datos ni servicios externos, permitiendo almacenar y organizar toda la información directamente en el sistema de archivos del usuario.


## Características actuales

- Panel central (`index.html`) para la gestión de fichas.
- Creación automática de hojas de trabajo a partir de una plantilla base.
- Almacenamiento local mediante File System Access API.
- Organización de las fichas dentro de la carpeta `notas`.
- Apertura de fichas mediante servidor HTTP local.
- Gestión de permisos persistentes sobre la carpeta raíz del proyecto.
- Lanzador en Python para:
  - Iniciar el servidor local.
  - Abrir automáticamente la aplicación en el navegador.
- Ejecutable independiente generado mediante PyInstaller.
- Recursos compartidos organizados en carpetas separadas.

## Estructura del proyecto

```text
LoworkShop/
│
├── assets/
│
├── build/
│
├── config/
│
├── dist/
│
├── img/
│
├── notas/
│
├── plantillas/
│
├── .gitignore
├── index.html
│
├── loworkshop.py
├── loworkshop.spec
├── loworkshop.exe
│
└── README.md
```

## Descripción de carpetas

| Carpeta | Función |
|----------|----------|
| assets | Recursos compartidos (CSS, JavaScript, etc.) |
| config | Configuración futura del proyecto |
| img | Imágenes generales de la aplicación |
| notas | Fichas de reparación generadas |
| plantillas | Plantillas HTML utilizadas para crear nuevas fichas |

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- File System Access API
- Python
- PyInstaller

## Filosofía del proyecto

LoworkShop busca ser una herramienta sencilla, ligera y completamente local.

Toda la información permanece bajo control del usuario, evitando dependencias de servicios externos, bases de datos o aplicaciones de terceros.

## Objetivos futuros

### Biblioteca de vehículos

Implementar una biblioteca local de imágenes organizada por marcas y modelos.

Ejemplo:

```text
coches/
├── seat/
├── volkswagen/
├── renault/
└── peugeot/
```

Las fichas podrán seleccionar imágenes directamente desde esta biblioteca sin depender de recursos externos.

### Generación de PDF

Añadir exportación de fichas a PDF desde la propia hoja de trabajo.

Objetivos:

- Generación bajo demanda.
- Almacenamiento en una carpeta dedicada.
- Mantener la ficha HTML editable.
- Conservar una versión PDF para impresión o archivo.

Estructura prevista:

```text
notas/
├── CLIENTE.html

pdf/
├── CLIENTE.pdf
```

### Mejoras de gestión

- Búsqueda avanzada de fichas.
- Clasificación por cliente o matrícula.
- Configuración centralizada.
- Copias de seguridad.
- Exportación de datos.

## Estado del proyecto

Actualmente LoworkShop se encuentra en desarrollo activo y continúa evolucionando con el objetivo de convertirse en una herramienta práctica para la gestión diaria de reparaciones y trabajos de taller.