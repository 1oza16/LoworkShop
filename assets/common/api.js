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

async function getHtml(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
}

async function post(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
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
    getIndexCars() {
        return get("/api/coches");
    },
    listSheets() {
        return get("/api/listar-hojas");
    },
    getImage(id) {
        return `/api/retornar-imagen/${id}`;
    },
    loadView(view) {
        return getHtml(`/api/retornar-view/${view}`);
    },
    loadSheet(sheet) {
        return get(`/api/retornar-hoja/${encodeURIComponent(sheet)}`);
    },

    // POST
    createSheet(client, plate, model, date) {
        return post("/api/crear-hoja", {
            client,
            plate,
            model,
            date
        })
    },
    saveSheet(name, html, pdfHtml) { 
        return post("/api/guardar-hoja", {
            name,
            html,
            pdfHtml
        });
    },
    eliminateSheet(name) {
        return post("/api/eliminar-hoja", {
            name
        })
    },
    postLocalImage(brand, model, name, image) {
        return post("/api/subir-foto", {
            brand,
            model,
            name,
            image
        });
    },
    postUrlImage(brand, model, name, image) {
        return post("/api/guardar-url", {
            brand,
            model,
            name,
            image
        });
    },
    eliminateImage(id) {
        return post("/api/eliminar-imagen", {
            id
        })
    }, 
};
