const views = {
    home: () => Home(),
    sheets: () => Sheets(),
    album: () => Album(),
    statistics: () => Statistics(),
    database: () => Database(),
    settings: () => Settings()
};

let actualView = null;
let navigationId = 0;
const main = document.getElementById("mainContent");

// Menu lateral
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("btnMenu");

    sidebar.classList.toggle("collapsed");
    menuButton.classList.toggle("collapsed");
} // toggleSidebar()

async function changeView(nameView) {
    ++navigationId
    const currentNavigation = navigationId;
    
    openSpinner(true);

    try {
        if (actualView) {
            actualView.unmount();
            actualView = null;
        }

        const html = await API.loadView(nameView);

        if (currentNavigation !== navigationId)
            return;

        main.innerHTML = html;
        const createView = views[nameView];

        if (!createView)
            throw new Error(`Vista no registrada: ${nameView}`);

        const controller = createView();
        actualView = controller;
        await controller.mount(main);

        if (currentNavigation !== navigationId)
            return;

        const btn = document.getElementById(nameView);

        document.querySelector(".active")?.classList.remove("active");
        document.getElementById("texto-estado").textContent = btn.querySelector("span").textContent;
        btn.classList.add("active");

    } catch (error) {
        console.error(error);

        document.querySelector(".active")?.classList.remove("active");;
        document.getElementById("texto-estado").textContent = "Error";

        if (currentNavigation === navigationId) {
            main.innerHTML = `
                <div>
                    Error al cargar la vista.
                </div>
            `;
        }

    } finally {
        closeSpinner();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await changeView("database");
});
