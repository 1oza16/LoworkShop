![Logo](/img/isologo.png)

# LoworkShop

LoworkShop es una aplicación de escritorio orientada a la gestión y documentación de reparaciones de vehículos mediante fichas de trabajo HTML totalmente editables.

El proyecto está diseñado para funcionar completamente en local, almacenando toda la información directamente en el sistema de archivos del usuario, sin utilizar bases de datos ni servicios externos.

---

# Características actuales

## Gestión de fichas

- Creación automática de hojas de trabajo desde una plantilla.
- Edición mediante HTML enriquecido (`contenteditable`).
- Apertura de fichas existentes.
- Guardado manual.
- Sistema de autoguardado (en desarrollo).
- Barra superior con:
  - Nombre de la hoja.
  - Estado del guardado.
  - Hora del último guardado.

---

## Exportación

- Guardado automático de la ficha HTML.
- Generación automática del PDF asociado.
- Carpeta independiente para documentos PDF.

```
notas/
    Reparación A.html

pdf/
    Reparación A.pdf
```

La generación del PDF mantiene la hoja HTML completamente editable.

---

## Biblioteca de vehículos

Biblioteca local organizada por:

```
fotos_coches/

    marca/

        modelo/

            imagen1.jpg
            imagen2.png
```

Características:

- Selección de imágenes mediante modal.
- Organización por marca y modelo.
- Vista previa.
- Miniaturas.
- Índice automático (`index.json`).
- Identificadores UUID persistentes, conservados al renombrar imágenes, modelos o marcas.
- Registro interno `.image_ids.json` que asocia los UUID con sus rutas actuales.
- Actualización automática del índice al añadir imágenes.

El índice tiene la estructura:

```
fotos_coches/
    index.json
```

---

## Gestión de imágenes

Desde el navegador es posible:

- Utilizar imágenes ya existentes.
- Añadir imágenes locales.
- Añadir imágenes mediante URL.
- Crear automáticamente nuevas marcas.
- Crear automáticamente nuevos modelos.
- Guardar imágenes dentro de la biblioteca.

Todo ello sin abandonar la aplicación.

---

## Editor enriquecido

La hoja dispone de un editor similar al de un procesador de textos.

Incluye:

- Negrita.
- Cursiva.
- Subrayado.
- Listas.
- Alineaciones.
- Copiar formato.
- Tamaño de fuente.
- Inserción de imágenes.
- Edición directa sobre la hoja.

---

## Servidor Python

El lanzador Python incorpora distintos endpoints para gestionar los recursos del proyecto.

Actualmente permite:

- Crear fichas.
- Guardar hojas HTML.
- Generar PDF.
- Gestionar imágenes.
- Descargar imágenes desde URL.
- Regenerar automáticamente `index.json`.
- Servir los recursos de la aplicación.

Toda la lógica relacionada con el sistema de archivos reside en Python.

---

# Estructura del proyecto

```
LoworkShop/

│
├── assets/
│
├── config/
│
├── fotos_coches/
│   ├── marca/
│   └── index.json
│
├── img/
│
├── notas/
│
├── pdf/
│
├── plantillas/
│
├── index.html
├── loworkshop.html
│
├── loworkshop.py
├── loworkshop.spec
│
└── README.md
```

---

# Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript (ES6)
- Python
- WeasyPrint
- PyInstaller

---

# Arquitectura

Actualmente la aplicación utiliza un servidor HTTP local implementado en Python.

```
HTML
     │
JavaScript
     │
fetch()
     │
Servidor Python
     │
Sistema de archivos
```

Toda la manipulación de archivos se realiza desde Python.

El frontend únicamente solicita operaciones mediante la API interna.

---

# Próximas implementaciones

## Autoguardado

- Guardado automático mediante debounce.
- Indicador visual de estado.
- Sincronización HTML + PDF.

---

## Compartir PDF

Nuevo modal para compartir el PDF generado mediante distintas opciones.

---

## Migración a PyWebView

En una fase posterior el servidor HTTP será sustituido por PyWebView.

La lógica permanecerá en Python y el frontend accederá a ella mediante una API JavaScript, eliminando la necesidad de utilizar endpoints HTTP.

La arquitectura prevista será:

```
HTML
     │
JavaScript
     │
pywebview.api
     │
Python
     │
Sistema de archivos
```

El objetivo es convertir LoworkShop en una aplicación de escritorio completamente autocontenida.

---

# Filosofía del proyecto

LoworkShop pretende ser una herramienta profesional para talleres, ligera, rápida y completamente local.
Todos los documentos permanecen bajo control del usuario, sin depender de servicios externos, bases de datos ni almacenamiento en la nube.
El proyecto está siendo desarrollado con una arquitectura modular para facilitar futuras ampliaciones y mantener un código sencillo de mantener.