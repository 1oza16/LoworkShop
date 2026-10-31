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
        error.newName = data.newName;
        throw error;
    }

    return data;
}

async function get(url, options = {}) {
    const response = await fetch(url, options);

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
    // SSE
    subscribe(channel, onUpdate, signal = null) {
        if (!("EventSource" in window)) {
            console.warn("EventSource no soportado en este entorno.");
            return null;
        }

        if (signal?.aborted) {
            return null;
        }

        const source = new EventSource(
            `/api/stream/${encodeURIComponent(channel)}`
        );
        source.addEventListener("update", () => {
            if (!signal?.aborted && typeof onUpdate === "function") {
                onUpdate();
            }
        });

        signal?.addEventListener(
            "abort",
            () => source.close(),
            { once: true }
        );

        return source;
    },

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
    getDatabaseTables() {
        return get("/api/database/tables");
    },
    getStatisticsData(signal) {
        return get("/api/statistics/data", { signal });
    },
    getDatabaseRecords(table) {
        return get(`/api/database/records?table=${encodeURIComponent(table)}`);
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
    createSheet(data) {
        return post("/api/create-sheet", data);
    },
    saveSheet(name, html, pdfHtml, datosCabecera = null, overwrite = false) {
        return post("/api/save-sheet", {
            name,
            html,
            pdfHtml,
            datosCabecera,
            overwrite
        });
    },
    updateSheetMetadata(name, headerData, overwrite = false) {
        return post("/api/update-sheet-metadata", {
            name,
            headerData,
            overwrite
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
    createDatabaseRecord(table, data) {
        return post("/api/database/record", {
            table,
            data
        });
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
    updateDatabaseRecord(table, pkCol, pkValue, data) {
        return put("/api/database/record", {
            table,
            pkCol,
            pkValue,
            data
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
    deleteDatabaseRecord(table, pkCol, pkValue) {
        return del("/api/database/record", {
            table,
            pkCol,
            pkValue
        });
    }
};
