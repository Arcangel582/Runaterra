const API_URL = "https://script.google.com/macros/s/AKfycbwRkxQnE_MQFHhtpHQLN4tq9hUNXN-_jFW3t9yefwNntODkUDikAsH2Tjb1zgeb7eCx/exec";

const XP_TABLE = [
  { level: 1, xp: 0, proficiency: 2 },
  { level: 2, xp: 300, proficiency: 2 },
  { level: 3, xp: 900, proficiency: 2 },
  { level: 4, xp: 2700, proficiency: 2 },
  { level: 5, xp: 6500, proficiency: 3 },
  { level: 6, xp: 14000, proficiency: 3 },
  { level: 7, xp: 23000, proficiency: 3 },
  { level: 8, xp: 34000, proficiency: 3 },
  { level: 9, xp: 48000, proficiency: 4 },
  { level: 10, xp: 64000, proficiency: 4 },
  { level: 11, xp: 85000, proficiency: 4 },
  { level: 12, xp: 100000, proficiency: 4 },
  { level: 13, xp: 120000, proficiency: 5 },
  { level: 14, xp: 140000, proficiency: 5 },
  { level: 15, xp: 165000, proficiency: 5 },
  { level: 16, xp: 195000, proficiency: 5 },
  { level: 17, xp: 225000, proficiency: 6 },
  { level: 18, xp: 265000, proficiency: 6 },
  { level: 19, xp: 305000, proficiency: 6 },
  { level: 20, xp: 355000, proficiency: 6 },
];

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
let availableMonedas = [];
let availableItems = [];

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupDynamicActions();

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
      availableMonedas = response.monedas || [];
      availableItems = response.items || [];

      if (!availableMonedas.length) {
        availableMonedas = extraerMonedasDesdeJugadores(response.jugadores || []);
      }

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

function extraerMonedasDesdeJugadores(jugadores) {
  const mapa = new Map();

  jugadores.forEach(jugadorData => {
    (jugadorData.dinero || []).forEach(moneda => {
      if (!mapa.has(moneda.moneda_id)) {
        mapa.set(moneda.moneda_id, {
          moneda_id: moneda.moneda_id,
          nombre: moneda.nombre || moneda.moneda_id,
          region: moneda.region || "",
          imagen: moneda.imagen || "",
          descripcion: moneda.descripcion || "",
          activa: "sí"
        });
      }
    });
  });

  return Array.from(mapa.values());
}

/* =========================
   RENDER GENERAL
========================= */

function renderJugador(data) {
  renderFicha(data);
  renderInventario(data.inventario || []);
  renderDinero(data.dinero || []);
}

function renderDM(jugadores) {
  fichaContainer.innerHTML = `
    <h2 class="section-title">Panel del DM: Experiencia</h2>

    <div class="dm-note">
      Desde aquí puedes sumar, quitar o establecer experiencia exacta. El sistema actualiza nivel y bono de competencia automáticamente.
    </div>

    <div class="cards-grid">
      ${jugadores.map(j => renderDMXpCard(j)).join("")}
    </div>

    <h2 class="section-title">Resumen de fichas</h2>

    <div class="cards-grid">
      ${jugadores.map(j => renderMiniJugador(j)).join("")}
    </div>
  `;

  inventarioContainer.innerHTML = `
    <h2 class="section-title">Panel del DM: Items</h2>

    <div class="dm-note">
    Desde aquí puedes entregar items existentes a los jugadores o quitar items de sus inventarios. Los items quitados se desactivan en Sheets, no se borran.
    </div>

    <div class="cards-grid">
      ${jugadores.map(j => renderDMItemCard(j)).join("")}
    </div>

    <h2 class="section-title">Resumen de inventarios</h2>

    ${jugadores.map(j => `
      <div class="panel-card">
        <h3>${escapeHtml(j.jugador.personaje || j.jugador.jugador_id)}</h3>
        ${renderInventarioHTML(j.inventario || [])}
      </div>
    `).join("")}
  `;

dineroContainer.innerHTML = `
  <h2 class="section-title">Panel del DM: Dinero</h2>

  <div class="dm-note">
    Desde aquí puedes sumar, quitar o establecer dinero exacto para cada jugador. Si el jugador no tiene esa moneda, el sistema puede crearla al sumar o establecer.
  </div>

  <div class="cards-grid">
    ${jugadores.map(j => renderDMMoneyCard(j)).join("")}
  </div>

  <h2 class="section-title">Resumen de dinero</h2>

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
  const xpInfo = getXPProgress(ficha.experiencia);

  return `
    <article class="panel-card">
      <h3>${escapeHtml(jugador.personaje || jugador.jugador_id || "Personaje")}</h3>
      <p>${escapeHtml(ficha.clase || "")} nivel ${escapeHtml(ficha.nivel || xpInfo.level || "")}</p>
      <p>XP: ${formatNumber(ficha.experiencia || 0)}</p>
      <p>PG: ${escapeHtml(ficha.pg_actuales || "0")} / ${escapeHtml(ficha.pg_maximos || "0")}</p>
      <p>CA: ${escapeHtml(ficha.ca || "0")}</p>
      ${renderXPBar(ficha.experiencia)}
    </article>
  `;
}

/* =========================
   FICHA Y XP
========================= */

function renderFicha(data) {
  const jugador = data.jugador || {};
  const ficha = data.ficha || {};
  const xpInfo = getXPProgress(ficha.experiencia);

  fichaContainer.innerHTML = `
    <article class="character-card">
      <div class="character-header">
        <img class="character-image" src="${safeImage(jugador.imagen)}" alt="Imagen de personaje" />

        <div class="character-title">
          <h2>${escapeHtml(jugador.personaje || jugador.jugador_id || "Personaje")}</h2>
          <p>${escapeHtml(ficha.especie || "")} | ${escapeHtml(ficha.clase || "")} nivel ${escapeHtml(ficha.nivel || xpInfo.level || "")}</p>
          <p>Trasfondo: ${escapeHtml(ficha.trasfondo || "Sin trasfondo")}</p>
          <p>Región: ${escapeHtml(jugador.region || "Sin región")}</p>
        </div>
      </div>

      <div class="xp-section">
        <div class="xp-header">
          <div>
            <span class="stat-label">Experiencia</span>
            <strong>${formatNumber(ficha.experiencia || 0)} XP</strong>
          </div>

          <div>
            <span class="stat-label">Progreso</span>
            <strong>${xpInfo.maxLevel ? "Nivel máximo" : `${formatNumber(xpInfo.missing)} XP para nivel ${xpInfo.nextLevel}`}</strong>
          </div>
        </div>

        ${renderXPBar(ficha.experiencia)}
      </div>

      <div class="stats-grid">
        ${statBox("Nivel", ficha.nivel || xpInfo.level)}
        ${statBox("Competencia", "+" + valueOrZero(ficha.competencia || xpInfo.proficiency))}
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

function renderDMItemCard(data) {
  const jugador = data.jugador || {};
  const inventario = data.inventario || [];

  const opcionesItems = availableItems.map(item => `
    <option value="${escapeHtml(item.item_id)}">
      ${escapeHtml(item.nombre || item.item_id)}${item.tipo ? ` - ${escapeHtml(item.tipo)}` : ""}
    </option>
  `).join("");

  return `
    <article class="panel-card dm-item-card">
      <h3>${escapeHtml(jugador.personaje || jugador.jugador_id)}</h3>

      <div class="dm-inventory-list">
        ${inventario.length
          ? inventario.map(item => `
            <div class="dm-inventory-row">
              <div>
                <strong>${escapeHtml(item.nombre || item.item_id)}</strong>
                <span>${escapeHtml(item.tipo || "Item")} | Cantidad: ${valueOrZero(item.cantidad)} | Cargas: ${valueOrZero(item.cargas_actuales)} / ${valueOrZero(item.cargas_maximas)}</span>
              </div>

              <form class="dm-remove-item-form" data-inventario-id="${escapeHtml(item.inventario_id)}">
                <button type="submit" class="secondary-button danger-button">Quitar</button>
              </form>
            </div>
          `).join("")
          : `<p class="empty-small">No tiene items registrados.</p>`
        }
      </div>

      <form class="dm-item-form" data-jugador-id="${escapeHtml(jugador.jugador_id)}">
        <label>Item</label>
        <select name="item_id" required>
          <option value="">Selecciona item</option>
          ${opcionesItems}
        </select>

        <div class="dm-form-grid">
          <div>
            <label>Cantidad</label>
            <input type="number" name="cantidad" min="1" step="1" value="1" required />
          </div>

          <div>
            <label>Cargas actuales</label>
            <input type="number" name="cargas_actuales" min="0" step="1" placeholder="Ej. 3" />
          </div>

          <div>
            <label>Cargas máximas</label>
            <input type="number" name="cargas_maximas" min="0" step="1" placeholder="Ej. 3" />
          </div>
        </div>

        <label>Equipado</label>
        <select name="equipado">
          <option value="no">No</option>
          <option value="sí">Sí</option>
        </select>

        <label>Notas</label>
        <input type="text" name="notas" placeholder="Ej. Recompensa de misión, comprado, prestado..." />

        <div class="dm-button-row single-action">
          <button type="submit">Dar item</button>
        </div>
      </form>

      <p class="dm-action-message" id="itemMessage-${escapeHtml(jugador.jugador_id)}"></p>
    </article>
  `;
}

function renderDMMoneyCard(data) {
  const jugador = data.jugador || {};
  const dinero = data.dinero || [];

  const opcionesMonedas = availableMonedas.map(moneda => `
    <option value="${escapeHtml(moneda.moneda_id)}">
      ${escapeHtml(moneda.nombre || moneda.moneda_id)}${moneda.region ? ` - ${escapeHtml(moneda.region)}` : ""}
    </option>
  `).join("");

  return `
    <article class="panel-card dm-money-card">
      <h3>${escapeHtml(jugador.personaje || jugador.jugador_id)}</h3>

      <div class="money-summary-list">
        ${dinero.length
          ? dinero.map(moneda => `
            <div class="money-summary-row">
              <span>${escapeHtml(moneda.nombre || moneda.moneda_id)}</span>
              <strong>${formatNumber(moneda.cantidad || 0)}</strong>
            </div>
          `).join("")
          : `<p class="empty-small">No tiene monedas registradas.</p>`
        }
      </div>

      <form class="dm-money-form" data-jugador-id="${escapeHtml(jugador.jugador_id)}">
        <label>Moneda</label>
        <select name="moneda_id" required>
          <option value="">Selecciona moneda</option>
          ${opcionesMonedas}
        </select>

        <label>Cantidad</label>
        <input type="number" name="cantidad" min="0" step="1" placeholder="Ej. 50" required />

        <div class="dm-button-row">
          <button type="submit" data-money-action="sumarDinero">Agregar</button>
          <button type="submit" data-money-action="restarDinero" class="secondary-button">Quitar</button>
          <button type="submit" data-money-action="establecerDinero" class="secondary-button">Establecer</button>
        </div>
      </form>

      <p class="dm-action-message" id="moneyMessage-${escapeHtml(jugador.jugador_id)}"></p>
    </article>
  `;
}

function renderDMXpCard(data) {
  const jugador = data.jugador || {};
  const ficha = data.ficha || {};
  const xpInfo = getXPProgress(ficha.experiencia);

  return `
    <article class="panel-card dm-xp-card">
      <h3>${escapeHtml(jugador.personaje || jugador.jugador_id)}</h3>

      <p>
        <strong>Nivel:</strong> ${escapeHtml(ficha.nivel || xpInfo.level)}
        | <strong>Competencia:</strong> +${escapeHtml(ficha.competencia || xpInfo.proficiency)}
      </p>

      <p>
        <strong>XP actual:</strong> ${formatNumber(ficha.experiencia || 0)}
      </p>

      <p>
        ${xpInfo.maxLevel
          ? "Nivel máximo alcanzado."
          : `Faltan ${formatNumber(xpInfo.missing)} XP para nivel ${xpInfo.nextLevel}.`
        }
      </p>

      ${renderXPBar(ficha.experiencia)}

      <form class="dm-xp-form" data-jugador-id="${escapeHtml(jugador.jugador_id)}">
        <label>Cantidad de XP</label>
        <input type="number" name="cantidad" min="0" step="1" placeholder="Ej. 150" required />

        <div class="dm-button-row">
          <button type="submit" data-xp-action="sumarXP">Agregar XP</button>
          <button type="submit" data-xp-action="restarXP" class="secondary-button">Quitar XP</button>
          <button type="submit" data-xp-action="establecerXP" class="secondary-button">Establecer XP</button>
        </div>
      </form>

      <p class="dm-action-message" id="xpMessage-${escapeHtml(jugador.jugador_id)}"></p>
    </article>
  `;
}

function renderXPBar(xpValue) {
  const xpInfo = getXPProgress(xpValue);

  return `
    <div class="xp-bar-wrap">
      <div class="xp-bar-meta">
        <span>Nivel ${xpInfo.level}</span>
        <span>${xpInfo.percent}%</span>
      </div>

      <div class="xp-bar">
        <div class="xp-bar-fill" style="width: ${xpInfo.percent}%"></div>
      </div>

      <div class="xp-bar-text">
        ${xpInfo.maxLevel
          ? `${formatNumber(xpInfo.currentXP)} XP | Nivel máximo`
          : `${formatNumber(xpInfo.currentXP)} / ${formatNumber(xpInfo.nextXP)} XP`
        }
      </div>
    </div>
  `;
}

function getXPProgress(xpValue) {
  const xp = Math.max(0, Math.floor(Number(xpValue || 0)));

  let current = XP_TABLE[0];
  let next = null;

  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i].xp) {
      current = XP_TABLE[i];
      next = XP_TABLE[i + 1] || null;
    } else {
      break;
    }
  }

  if (!next) {
    return {
      currentXP: xp,
      level: current.level,
      proficiency: current.proficiency,
      currentLevelXP: current.xp,
      nextXP: current.xp,
      nextLevel: current.level,
      missing: 0,
      percent: 100,
      maxLevel: true
    };
  }

  const totalInLevel = next.xp - current.xp;
  const gainedInLevel = xp - current.xp;
  const percent = Math.max(0, Math.min(100, Math.floor((gainedInLevel / totalInLevel) * 100)));

  return {
    currentXP: xp,
    level: current.level,
    proficiency: current.proficiency,
    currentLevelXP: current.xp,
    nextXP: next.xp,
    nextLevel: next.level,
    missing: Math.max(0, next.xp - xp),
    percent,
    maxLevel: false
  };
}

/* =========================
   INVENTARIO Y DINERO
========================= */

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

/* =========================
   ACCIONES DINÁMICAS
========================= */

function setupDynamicActions() {
  document.addEventListener("submit", async (event) => {
    const form = event.target;

    if (form.classList.contains("dm-xp-form")) {
      event.preventDefault();
      await handleXPFormSubmit(form, event.submitter);
    }

    if (form.classList.contains("dm-money-form")) {
      event.preventDefault();
      await handleMoneyFormSubmit(form, event.submitter);
    }

    if (form.classList.contains("dm-item-form")) {
      event.preventDefault();
      await handleItemFormSubmit(form);
    }

    if (form.classList.contains("dm-remove-item-form")) {
      event.preventDefault();
      await handleRemoveItemSubmit(form);
    }
  });
}

async function handleItemFormSubmit(form) {
  if (!currentSession || currentSession.rol !== "dm") {
    alert("Solo el DM puede entregar items.");
    return;
  }

  const jugadorId = form.dataset.jugadorId;
  const itemId = form.elements.item_id.value;
  const cantidad = form.elements.cantidad.value || 1;
  const cargasActuales = form.elements.cargas_actuales.value;
  const cargasMaximas = form.elements.cargas_maximas.value;
  const equipado = form.elements.equipado.value || "no";
  const notas = form.elements.notas.value || "";

  const message = document.getElementById(`itemMessage-${jugadorId}`);

  if (!itemId) {
    if (message) message.textContent = "Selecciona un item.";
    return;
  }

  try {
    if (message) message.textContent = "Entregando item...";

    const response = await apiRequest("darItem", {
      token: currentSession.token,
      jugador_id: jugadorId,
      item_id: itemId,
      cantidad: cantidad,
      cargas_actuales: cargasActuales,
      cargas_maximas: cargasMaximas,
      equipado: equipado,
      notas: notas
    });

    if (!response.ok) {
      throw new Error(response.error || "No se pudo entregar el item.");
    }

    if (message) {
      message.textContent = `Item entregado. ID: ${response.inventario_id}`;
    }

    form.reset();
    await cargarDatos();

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

async function handleRemoveItemSubmit(form) {
  if (!currentSession || currentSession.rol !== "dm") {
    alert("Solo el DM puede quitar items.");
    return;
  }

  const inventarioId = form.dataset.inventarioId;

  if (!inventarioId) {
    alert("No se encontró inventario_id.");
    return;
  }

  const confirmar = confirm("¿Seguro que quieres quitar este item del inventario? No se borrará, quedará inactivo en Sheets.");

  if (!confirmar) {
    return;
  }

  try {
    const response = await apiRequest("quitarItem", {
      token: currentSession.token,
      inventario_id: inventarioId
    });

    if (!response.ok) {
      throw new Error(response.error || "No se pudo quitar el item.");
    }

    await cargarDatos();

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function handleMoneyFormSubmit(form, submitter) {
  if (!currentSession || currentSession.rol !== "dm") {
    alert("Solo el DM puede modificar dinero.");
    return;
  }

  const jugadorId = form.dataset.jugadorId;
  const monedaId = form.elements.moneda_id.value;
  const cantidad = form.elements.cantidad.value;
  const action = submitter?.dataset?.moneyAction;

  const message = document.getElementById(`moneyMessage-${jugadorId}`);

  if (!action) {
    if (message) message.textContent = "No se reconoció la acción de dinero.";
    return;
  }

  if (!monedaId) {
    if (message) message.textContent = "Selecciona una moneda.";
    return;
  }

  if (!cantidad || Number(cantidad) < 0) {
    if (message) message.textContent = "Escribe una cantidad válida.";
    return;
  }

  try {
    if (message) message.textContent = "Actualizando dinero...";

    const response = await apiRequest(action, {
      token: currentSession.token,
      jugador_id: jugadorId,
      moneda_id: monedaId,
      cantidad
    });

    if (!response.ok) {
      throw new Error(response.error || "No se pudo actualizar dinero.");
    }

    if (message) {
      message.textContent = `Listo: ${response.cantidad_anterior} → ${response.cantidad_nueva}.`;
    }

    await cargarDatos();

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

async function handleXPFormSubmit(form, submitter) {
  if (!currentSession || currentSession.rol !== "dm") {
    alert("Solo el DM puede modificar experiencia.");
    return;
  }

  const jugadorId = form.dataset.jugadorId;
  const cantidad = form.elements.cantidad.value;
  const action = submitter?.dataset?.xpAction;

  const message = document.getElementById(`xpMessage-${jugadorId}`);

  if (!action) {
    if (message) message.textContent = "No se reconoció la acción de XP.";
    return;
  }

  if (!cantidad || Number(cantidad) < 0) {
    if (message) message.textContent = "Escribe una cantidad válida.";
    return;
  }

  try {
    if (message) message.textContent = "Actualizando XP...";

    const response = await apiRequest(action, {
      token: currentSession.token,
      jugador_id: jugadorId,
      cantidad
    });

    if (!response.ok) {
      throw new Error(response.error || "No se pudo actualizar XP.");
    }

    if (message) {
      message.textContent = `Listo: ${response.xp_anterior} XP → ${response.xp_nueva} XP. Nivel ${response.nivel}.`;
    }

    await cargarDatos();

  } catch (error) {
    console.error(error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

/* =========================
   TABS
========================= */

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

/* =========================
   API
========================= */

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

/* =========================
   UTILIDADES
========================= */

function statBox(label, value) {
  return `
    <div class="stat-box">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="stat-value">${escapeHtml(value || "0")}</span>
    </div>
  `;
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

function formatNumber(value) {
  const number = Number(value || 0);

  return number.toLocaleString("es-MX");
}
