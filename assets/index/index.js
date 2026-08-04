const main = document.getElementById("mainContent");

// Menu lateral
function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("collapsed");
} // toggleSidebar()

async function loadView(nameView) {
    try {
        const response = await fetch(`../../views/${nameView}.html`);

        if (!response.ok)
            throw new Error(`No se pudo cargar la vista "${nameView}".`);

        const html = await response.text();
        main.innerHTML = html;

        const btn = document.getElementById(nameView);
        document.querySelector(".active")?.classList.remove("active");
        document.getElementById('texto-estado').textContent = btn.querySelector("span").textContent;
        btn.classList.add('active');
    }
    catch (error) {
        console.error(error);

        // Cambiar por toast y cargar home de nuevo
        main.innerHTML = `
            <div class="error-view">
                Error al cargar la vista.
            </div>
        `;
    }
}

async function changeView(nameView) {
    await loadView(nameView);
}

document.addEventListener("DOMContentLoaded", async () => {
    await changeView("home");
});
