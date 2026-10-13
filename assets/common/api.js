// Hacer funciones de llamadas API aqui. Ejemplo:
async function request(url, method, payload = null) {
    const options = {
        method,
        headers: {
            "Content-Type": "application/json"
        }
    };

    if (payload !== null) {
        options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);

    const data = await response.json();

    if (!response.ok || data.ok === false) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.conflict = data.conflict === true;
        throw error;
    }

    return data;
}

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
    return request(url, "POST", payload);
}

async function put(url, payload) {
    return request(url, "PUT", payload);
}

async function del(url, payload) {
    return request(url, "DELETE", payload);
}

const API = {
    // GET
    getIndexCars() {
        return get("/api/get-cars-index");
    },
    getIndexCovers() {
        return get("/api/get-covers-index");
    },
    listSheets() {
        return get("/api/list-sheets");
    },
    getImage(id) {
        return `/api/get-image/${id}`;
    },
    loadView(view) {
        return getHtml(`/api/get-view/${view}`);
    },
    loadSheet(sheet) {
        return get(`/api/get-sheet/${encodeURIComponent(sheet)}`);
    },

    // POST
    createSheet(client, plate, model, date) {
        return post("/api/create-sheet", {
            client,
            plate,
            model,
            date
        })
    },
    saveSheet(name, html, pdfHtml) { 
        return post("/api/save-sheet", {
            name,
            html,
            pdfHtml
        });
    },
    eliminateSheet(name) {
        return post("/api/delete-sheet", {
            name
        })
    },
    savePhoto(brand, model, name, image, overwrite = false) {
        return post("/api/save-photo", {
            brand,
            model,
            name,
            image,
            overwrite
        });
    },
    createAlbumFolder(type, brand, name, overwrite = false) {
        return post("/api/create-album-folder", {
            type,
            brand,
            name,
            overwrite
        });
    },
    eliminateImage(id) {
        return post("/api/delete-image", {
            id
        })
    }, 

    // PUT
    saveCover(tipo, marca, modelo, imagen) {
        return put("/api/save-cover", {
            tipo,
            marca,
            modelo,
            imagen
        })
    },
    renameAlbumItem(type, brand, model, imageId, newName, overwrite = false) {
        return put("/api/rename-album-item", {
            type,
            brand,
            model,
            imageId,
            newName,
            overwrite
        });
    },

    // DELETE
    eliminateCover(tipo, marca, modelo) {
        return del("/api/delete-cover", {
            tipo,
            marca,
            modelo
        })
    }, 
    eliminateAlbumFolder(type, brand, model) {
        return del("/api/delete-album-folder", {
            type,
            brand,
            model
        });
    },
};
