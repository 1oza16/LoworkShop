// Hacer funciones de llamadas API aqui. Ejemplo:

async function get(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.ok === false) {
        throw new Error(data.error || "Error desconocido");
    }

    return data;
}

async function post(url, datos) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(datos)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.ok === false) {
        throw new Error(data.error || "Error desconocido");
    }

    return data;
}

const API = {
    // GET
    obtenerCoches() {
        return get("/api/coches");
    },

    // POST
    guardarHoja(nombre, html, htmlPDF) {
        return post("/api/guardar-hoja", {
            nombre,
            html,
            htmlPDF
        });
    },
    subirFoto(marca, modelo, nombreFinal, base64) {
        return post("/api/subir-foto", {
            marca, 
            modelo, 
            nombreFinal, 
            base64
        });
    },
    guardarFotoURL(marca, modelo, nombreFinal, imagenPendiente) {
        return post("/api/guardar-url", {
            marca, 
            modelo, 
            nombreFinal, 
            imagenPendiente
        });
    }
};
