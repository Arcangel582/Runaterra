const API_URL = "https://script.google.com/macros/s/AKfycbwRkxQnE_MQFHhtpHQLN4tq9hUNXN-_jFW3t9yefwNntODkUDikAsH2Tjb1zgeb7eCx/exec";

const loginView = document.getElementById("loginView");
const mainView = document.getElementById("mainView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const sessionInfo = document.getElementById("sessionInfo");
const logoutBtn = document.getElementById("logoutBtn");

const fichaContainer = document.getElementById("fichaContainer");
const inventarioContainer = document.getElementById("inventarioContainer");
const dineroContainer = document.getElementById("dineroContainer");

let currentSession = null;
let currentData = null;

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();

  const savedSession = localStorage.getItem("runaterra_session");

  if (savedSession) {
    try {
      currentSession = JSON.parse(savedSession);
      cargarDatos();
    } catch {
      localStorage.removeItem("runaterra_session");
    }
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const usuario = document.getElementById("usuario").value.trim();
  const password = document.getElementById("password").value;

  loginMessage.textContent = "Entrando...";

  try {
    const response = await apiRequest("login", {
      usuario,
      password
    });

    if (!response.ok) {
      loginMessage.textContent = response.error || "No se pudo iniciar sesión.";
      return;
    }

    currentSession = {
      token: response.token,
      usuario: response.usuario,
      jugador_id: response.jugador_id,
      rol: response.rol
    };

    localStorage.setItem("runaterra_session", JSON.stringify(currentSession));

    loginMessage.textContent = "";
    await cargarDatos();

  } catch (error) {
    loginMessage.textContent = "Error de conexión con la API.";
    console.error(error);
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("runaterra_session");
  currentSession = null;
  currentData = null;

  mainView.classList.add("hidden");
  loginView.classList.remove("hidden");

  loginForm.reset();
});

async function cargarDatos() {
  if (!currentSession || !currentSession.token) {
    return;
  }

  try {
    sessionInfo.textContent = `Sesión: ${currentSession.usuario} | Rol: ${currentSession.rol}`;

    if (currentSession.rol === "dm") {
      const response = await apiRequest("obtenerDatosDM", {
        token: currentSession.token
      });

      if (!response.ok) {
        throw new Error(response.error || "No se pudieron cargar datos de DM.");
      }

      currentData = response.jugadores;
      renderDM(response.jugadores);

    } else {
      const response = await apiRequest("obtenerMisDatos", {
        token: currentSession.token
      });

      if (!response.ok) {
        throw new Error(response.error || "No se pudieron cargar tus datos.");
      }

      currentData = response.datos;
      renderJugador(response.datos);
    }

    loginView.classList.add("hidden");
    mainView.classList.remove("hidden");

  } catch (error) {
    console.error(error);
    localStorage.removeItem("runaterra_session");
    loginMessage.textContent = error.message;
    mainView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
}

function renderJugador(data) {
  renderFicha(data);
  renderInventario(data.inventario || []);
  renderDinero(data.dinero || []);
}

function renderDM(jugadores) {
  fichaContainer.innerHTML = `
    <h2 class="section-title">Panel del DM</h2>
    <div class="cards-grid">
      ${jugadores.map(j => renderMiniJugador(j)).join("")}
    </div>
  `;

  inventarioContainer.innerHTML = `
    <h2 class="section-title">Inventarios de todos los jugadores</h2>
    ${jugadores.map(j => `
      <div class="panel-card">
        <h3>${escapeHtml(j.jugador.personaje || j.jugador.jugador_id)}</h3>
        ${renderInventarioHTML(j.inventario || [])}
      </div>
    `).join("")}
  `;

  dineroContainer.innerHTML = `
    <h2 class="section-title">Dinero de todos los jugadores</h2>
    ${jugadores.map(j => `
      <div class="panel-card">
        <h3>${escapeHtml(j.jugador.personaje || j.jugador.jugador_id)}</h3>
        ${renderDineroHTML(j.dinero || [])}
      </div>
    `).join("")}
  `;
}

function renderMiniJugador(data) {
  const jugador = data.jugador || {};
  const ficha = data.ficha || {};

  return `
    <article class="panel-card">
      <h3>${escapeHtml(jugador.personaje || jugador.jugador_id || "Personaje")}</h3>
      <p>${escapeHtml(ficha.clase || "")} nivel ${escapeHtml(ficha.nivel || "")}</p>
      <p>PG: ${escapeHtml(ficha.pg_actuales || "0")} / ${escapeHtml(ficha.pg_maximos || "0")}</p>
      <p>CA: ${escapeHtml(ficha.ca || "0")}</p>
    </article>
  `;
}

function renderFicha(data) {
  const jugador = data.jugador || {};
  const ficha = data.ficha || {};

  fichaContainer.innerHTML = `
    <article class="character-card">
      <div class="character-header">
        <img class="character-image" src="${safeImage(jugador.imagen)}" alt="Imagen de personaje" />

        <div class="character-title">
          <h2>${escapeHtml(jugador.personaje || jugador.jugador_id || "Personaje")}</h2>
          <p>${escapeHtml(ficha.especie || "")} | ${escapeHtml(ficha.clase || "")} nivel ${escapeHtml(ficha.nivel || "")}</p>
          <p>Trasfondo: ${escapeHtml(ficha.trasfondo || "Sin trasfondo")}</p>
          <p>Región: ${escapeHtml(jugador.region || "Sin región")}</p>
        </div>
      </div>

      <div class="stats-grid">
        ${statBox("Nivel", ficha.nivel)}
        ${statBox("Competencia", "+" + valueOrZero(ficha.competencia))}
        ${statBox("CA", ficha.ca)}
        ${statBox("PG", `${valueOrZero(ficha.pg_actuales)} / ${valueOrZero(ficha.pg_maximos)}`)}
        ${statBox("Iniciativa", "+" + valueOrZero(ficha.iniciativa))}
        ${statBox("Velocidad", ficha.velocidad)}
        ${statBox("Percepción pasiva", ficha.percepcion_pasiva)}
        ${statBox("Dado de golpe", ficha.dado_golpe)}
      </div>

      <div class="stats-grid">
        ${statBox("Fuerza", `${valueOrZero(ficha.fuerza)} (${formatMod(ficha.mod_fuerza)})`)}
        ${statBox("Destreza", `${valueOrZero(ficha.destreza)} (${formatMod(ficha.mod_destreza)})`)}
        ${statBox("Constitución", `${valueOrZero(ficha.constitucion)} (${formatMod(ficha.mod_constitucion)})`)}
        ${statBox("Inteligencia", `${valueOrZero(ficha.inteligencia)} (${formatMod(ficha.mod_inteligencia)})`)}
        ${statBox("Sabiduría", `${valueOrZero(ficha.sabiduria)} (${formatMod(ficha.mod_sabiduria)})`)}
        ${statBox("Carisma", `${valueOrZero(ficha.carisma)} (${formatMod(ficha.mod_carisma)})`)}
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <span class="stat-label">Rasgos</span>
          <p>${escapeHtml(ficha.rasgos_resumen || "Sin rasgos registrados.")}</p>
        </div>

        <div class="stat-box">
          <span class="stat-label">Conjuros</span>
          <p>${escapeHtml(ficha.conjuros_resumen || "Sin conjuros registrados.")}</p>
        </div>
      </div>
    </article>
  `;
}

function renderInventario(inventario) {
  inventarioContainer.innerHTML = `
    <h2 class="section-title">Items</h2>
    ${renderInventarioHTML(inventario)}
  `;
}

function renderInventarioHTML(inventario) {
  if (!inventario || inventario.length === 0) {
    return `<p class="empty">No hay items registrados.</p>`;
  }

  return `
    <div class="cards-grid">
      ${inventario.map(item => `
        <article class="item-card">
          <img class="item-image" src="${safeImage(item.imagen)}" alt="Imagen de item" />

          <div>
            <h3>${escapeHtml(item.nombre || item.item_id)}</h3>

            <span class="badge">${escapeHtml(item.tipo || "Item")}</span>
            <span class="badge">${escapeHtml(item.rareza || "Sin rareza")}</span>

            <p>${escapeHtml(item.descripcion || "Sin descripción.")}</p>

            ${item.dado ? `<p><strong>Dado:</strong> ${escapeHtml(item.dado)}</p>` : ""}
            ${item.efecto ? `<p><strong>Efecto:</strong> ${escapeHtml(item.efecto)}</p>` : ""}

            <p class="charges">Cargas: ${valueOrZero(item.cargas_actuales)} / ${valueOrZero(item.cargas_maximas)}</p>

            ${item.notas ? `<p><strong>Notas:</strong> ${escapeHtml(item.notas)}</p>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDinero(dinero) {
  dineroContainer.innerHTML = `
    <h2 class="section-title">Dinero</h2>
    ${renderDineroHTML(dinero)}
  `;
}

function renderDineroHTML(dinero) {
  if (!dinero || dinero.length === 0) {
    return `<p class="empty">No hay monedas registradas.</p>`;
  }

  return `
    <div class="cards-grid">
      ${dinero.map(moneda => `
        <article class="money-card">
          <img class="money-image" src="${safeImage(moneda.imagen)}" alt="Imagen de moneda" />

          <h3>${escapeHtml(moneda.nombre || moneda.moneda_id)}</h3>
          <p><strong>Cantidad:</strong> ${valueOrZero(moneda.cantidad)}</p>
          <p><strong>Región:</strong> ${escapeHtml(moneda.region || "Sin región")}</p>
          <p>${escapeHtml(moneda.descripcion || "")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const selected = button.dataset.tab;

      buttons.forEach(b => b.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(`${selected}Tab`).classList.add("active");
    });
  });
}

function statBox(label, value) {
  return `
    <div class="stat-box">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value || "0")}</span>
    </div>
  `;
}

function apiRequest(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_callback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const query = new URLSearchParams({
      action,
      callback: callbackName,
      ...params
    });

    const script = document.createElement("script");
    script.src = `${API_URL}?${query.toString()}`;

    window[callbackName] = (data) => {
      resolve(data);
      cleanup();
    };

    script.onerror = () => {
      reject(new Error("No se pudo conectar con Apps Script."));
      cleanup();
    };

    function cleanup() {
      delete window[callbackName];
      script.remove();
    }

    document.body.appendChild(script);
  });
}

function safeImage(path) {
  if (!path) {
    return "";
  }

  return String(path).trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function valueOrZero(value) {
  if (value === "" || value === null || value === undefined) {
    return "0";
  }

  return value;
}

function formatMod(value) {
  const number = Number(value || 0);

  if (number > 0) {
    return `+${number}`;
  }

  return String(number);
}