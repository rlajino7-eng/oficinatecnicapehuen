let todosLosElementos = [];
let historialRuta = [{ id: '', nombre: 'Directorio Principal' }];

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    if (!usuarioLogueado) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    } else {
        mostrarApp(usuarioLogueado);
    }

    // --- LOGIN ---
    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailLogin').value;
        const password = document.getElementById('passLogin').value;
        try {
            const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('usuarioPehuen', JSON.stringify(data.usuario));
                mostrarApp(data.usuario);
            } else {
                document.getElementById('loginError').textContent = data.error;
            }
        } catch (err) {
            document.getElementById('loginError').textContent = 'Error de conexión con el servidor.';
        }
    });

    // --- SUBIDA MASIVA Y CONTROL DE DUPLICADOS ---
    const formSubir = document.getElementById('formSubir');
    if (formSubir) {
        formSubir.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('archivoInput');
            if (input.files.length === 0) return;

            const carpetaActualId = historialRuta[historialRuta.length - 1].id;
            const formData = new FormData();
            
            // Agrega todos los archivos seleccionados al paquete
            for (let i = 0; i < input.files.length; i++) {
                formData.append('archivos', input.files[i]);
            }
            formData.append('parentId', carpetaActualId);

            const btn = formSubir.querySelector('.btn-upload');
            btn.textContent = 'Subiendo lote... ⏳';
            btn.style.background = '#f59e0b';
            
            try {
                const res = await fetch('/api/subir', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    let mensajeResultado = 'Resumen de carga:\n\n';
                    data.files.forEach(f => {
                        if (f.status === 'duplicado') {
                            mensajeResultado += `⚠️ DUPLICADO: "${f.name}" ya existe. No se subió.\n`;
                        } else {
                            mensajeResultado += `✅ ÉXITO: "${f.name}" guardado.\n`;
                        }
                    });
                    alert(mensajeResultado);
                    input.value = '';
                    document.getElementById('nombreSeleccionado').textContent = 'Ningún archivo...';
                    cargarElementos();
                } else alert('Error: ' + data.error);
            } catch (err) { alert('Error de red durante la subida masiva.'); }
            
            btn.textContent = '⬆ Subir aquí';
            btn.style.background = '#16a34a';
        });

        document.getElementById('archivoInput').addEventListener('change', (e) => {
            const cantidad = e.target.files.length;
            document.getElementById('nombreSeleccionado').textContent = cantidad > 0 ? `${cantidad} archivo(s) listo(s)` : 'Ningún archivo...';
        });
    }

    // --- BUSCADOR EN VIVO ---
    const buscador = document.getElementById('inputBuscador');
    if (buscador) {
        buscador.addEventListener('input', () => {
            renderizarDirectorioActual(); // Refresca la vista al teclear
        });
    }

    // --- AGREGAR USUARIOS ---
    const formUsuario = document.getElementById('formUsuario');
    if (formUsuario) {
        formUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nombreUser').value;
            const email = document.getElementById('emailUser').value;
            const password = document.getElementById('passUser').value;
            const rol = document.getElementById('rolUser').value;

            try {
                const res = await fetch('/api/usuarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, email, password, rol })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Usuario corporativo agregado correctamente.');
                    formUsuario.reset();
                    document.getElementById('passUser').value = 'pehuen123';
                    cargarUsuarios();
                }
            } catch (error) { alert('Error al agregar usuario.'); }
        });
    }
});

// --- INICIALIZACIÓN ---
function mostrarApp(usuario) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('badgeUsuario').textContent = `${usuario.nombre} (${usuario.rol.toUpperCase()})`;
    if (usuario.rol === 'admin') {
        document.getElementById('btnAdmin').style.display = 'inline-block';
        cargarUsuarios();
    }
    
    // Iniciar Widgets
    cargarClimaLaja();
    initChat();
    
    cargarElementos();
}

function cerrarSesion() {
    localStorage.removeItem('usuarioPehuen');
    location.reload();
}

async function cargarElementos() {
    try {
        const res = await fetch('/api/elementos');
        todosLosElementos = await res.json();
        renderizarDirectorioActual();
    } catch (err) { console.error('Error cargando elementos desde Drive', err); }
}

// --- RENDERIZADO INTELIGENTE (Grilla y Tablas) ---
function renderizarDirectorioActual() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const carpetaActual = historialRuta[historialRuta.length - 1];
    
    // Títulos y Botones de navegación
    document.getElementById('tituloDirectorio').textContent = `📁 ${carpetaActual.nombre}`;
    
    const btnVolver = document.getElementById('btnVolverAtras');
    const btnHome = document.getElementById('btnHome');
    if (historialRuta.length > 1) {
        btnVolver.style.display = 'inline-block';
        btnHome.style.display = 'inline-block';
    } else {
        btnVolver.style.display = 'none';
        btnHome.style.display = 'none';
    }

    const grilla = document.getElementById('grillaDirectorio');
    const contenedorTabla = document.getElementById('contenedorTablaArchivos');
    const listaArchivos = document.getElementById('listaArchivosCarpeta');
    const buscador = document.getElementById('inputBuscador') ? document.getElementById('inputBuscador').value.toLowerCase() : '';

    grilla.innerHTML = '';
    listaArchivos.innerHTML = '';

    // Filtrar elementos de la carpeta actual
    let elementosEnNivel = [];
    if(carpetaActual.id === '') {
        const idsPrimarios = todosLosElementos.filter(e => e.esCarpeta).map(e => e.parentId);
        const raizIdReal = idsPrimarios[0] || ''; 
        elementosEnNivel = todosLosElementos.filter(e => e.parentId === raizIdReal || e.parentId === '');
    } else {
        elementosEnNivel = todosLosElementos.filter(e => e.parentId === carpetaActual.id);
    }

    let carpetasFiltradas = elementosEnNivel.filter(e => e.esCarpeta);
    let archivosFiltrados = elementosEnNivel.filter(e => !e.esCarpeta);

    // Aplicar filtro del Buscador si hay texto escrito
    if (buscador.trim() !== '') {
        carpetasFiltradas = carpetasFiltradas.filter(c => c.name.toLowerCase().includes(buscador));
        archivosFiltrados = archivosFiltrados.filter(a => a.name.toLowerCase().includes(buscador));
    }

    // Actualizar contador superior de archivos
    const contador = document.getElementById('contadorArchivos');
    if (contador) contador.textContent = `(${archivosFiltrados.length} archivos)`;

    // Dibujar Tarjetas de Carpetas
    if (carpetasFiltradas.length === 0 && archivosFiltrados.length === 0) {
        grilla.innerHTML = `<p style="color: #64748b; grid-column: 1/-1;">${buscador ? 'No se encontraron resultados en esta carpeta.' : 'Esta carpeta está vacía.'}</p>`;
    } else {
        carpetasFiltradas.forEach(c => {
            let botonesAdminCarpeta = '';
            if (usuarioLogueado.rol === 'admin') {
                botonesAdminCarpeta = `
                    <div style="margin-top: 10px; display: flex; justify-content: center; gap: 5px;" onclick="event.stopPropagation()">
                        <button onclick="renombrarCarpeta('${c.id}', '${c.name}')" style="background: #0284c7; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;" title="Renombrar">✏️</button>
                        <button onclick="eliminarCarpeta('${c.id}', '${c.name}')" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;" title="Eliminar">🗑️</button>
                    </div>`;
            }

            grilla.innerHTML += `
                <div class="folder-card" onclick="entrarCarpeta('${c.id}', '${c.name}')">
                    <div class="folder-icon">📁</div>
                    <h3>${c.name}</h3>
                    <p>Subcarpeta</p>
                    ${botonesAdminCarpeta}
                </div>`;
        });
    }

    // Dibujar Tabla de Archivos
    if (archivosFiltrados.length > 0) {
        contenedorTabla.style.display = 'block';

        archivosFiltrados.forEach((a, index) => {
            const estaEnUso = a.estado === 'EN_USO';
            const esDueño = a.bloqueadoPor === usuarioLogueado.nombre;
            const esAdmin = usuarioLogueado.rol === 'admin';
            
            let etiquetaEstado = estaEnUso ? `<span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🔒 En uso por ${a.bloqueadoPor}</span>` : '';
            
            // ACCIONES
            let botones = '';
            if (estaEnUso) {
                if (esDueño || esAdmin) {
                    botones += `<button onclick="reemplazarArchivo('${a.id}')" style="background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-size: 12px;">⬆ Subir Modificado</button>`;
                }
                if (esAdmin) {
                    botones += `<button onclick="desbloquearArchivo('${a.id}')" style="background: #475569; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px;">Desbloquear</button>`;
                }
                botones += `<button style="background: #ccc; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 12px;" disabled>Eliminar</button>`;
            } else {
                botones += `<button onclick="bloquearArchivo('${a.id}', '${a.webContentLink}')" style="background: #eab308; color: black; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-size: 12px; font-weight: bold;">Bloquear</button>`;
                botones += `<button onclick="eliminarArchivo('${a.id}')" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>`;
            }

            // DATOS NUEVOS (N°, Carpeta, Peso, Observaciones)
            const correlativo = index + 1;
            const nombreTipoCarpeta = carpetaActual.nombre === 'Directorio Principal' ? 'RAÍZ' : carpetaActual.nombre.toUpperCase();
            const pesoFile = '-- KB'; // (Drive oculta el peso por defecto, pero dejamos la columna lista)
            
            // Recuperar nota guardada localmente
            const notaGuardada = localStorage.getItem(`obs_${a.id}`) || '';
            const casillaObservacion = `<input type="text" value="${notaGuardada}" placeholder="Añadir nota..." onchange="guardarObservacionLocal('${a.id}', this.value)" style="width: 140px; padding: 4px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: 'Inter', sans-serif;">`;

            listaArchivos.innerHTML += `
                <tr>
                    <td style="text-align: center; font-weight: bold; color: #64748b;">${correlativo}</td>
                    <td><strong style="color: #475569;">${nombreTipoCarpeta}</strong></td>
                    <td>
                        <a href="${a.webViewLink}" target="_blank" style="color: #004080; font-weight: 500; text-decoration: none;">${a.name}</a><br>
                        ${etiquetaEstado}
                    </td>
                    <td style="color: #64748b; font-size: 12px;">${pesoFile}</td>
                    <td>${a.createdTime ? new Date(a.createdTime).toLocaleDateString() : 'Reciente'}</td>
                    <td>${casillaObservacion}</td>
                    <td>${botones}</td>
                </tr>`;
        });
    } else {
        contenedorTabla.style.display = 'none';
    }
}

// --- NAVEGACIÓN ---
function entrarCarpeta(id, nombre) {
    historialRuta.push({ id: id, nombre: nombre });
    if(document.getElementById('inputBuscador')) document.getElementById('inputBuscador').value = '';
    renderizarDirectorioActual();
}

function subirNivelCarpeta() {
    if (historialRuta.length > 1) {
        historialRuta.pop();
        if(document.getElementById('inputBuscador')) document.getElementById('inputBuscador').value = '';
        renderizarDirectorioActual();
    }
}

function irAlInicio() {
    historialRuta = [{ id: '', nombre: 'Directorio Principal' }];
    if(document.getElementById('inputBuscador')) document.getElementById('inputBuscador').value = '';
    renderizarDirectorioActual();
}

// --- CREAR CARPETA Y CONTROL DE PERMISOS ---
async function crearCarpetaActual() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    
    // Bloqueo estricto: Solo admin crea en la raíz
    if (historialRuta.length === 1 && usuarioLogueado.rol !== 'admin') {
        alert('⛔ Acceso Denegado: Solo los Administradores Técnicos pueden crear Carpetas Principales en este nivel (Ej: CRITERIOS DE EVALUACIÓN EMPRESAS, EMPRESA).');
        return;
    }

    const nombre = prompt('Ingresa el nombre de la nueva carpeta:');
    if (!nombre || !nombre.trim()) return;

    const carpetaActualId = historialRuta[historialRuta.length - 1].id;

    try {
        const res = await fetch('/api/carpetas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), parentId: carpetaActualId })
        });
        const data = await res.json();
        if (data.success) {
            cargarElementos(); // El servidor ya sabe si era nueva o si se evitó un duplicado
        } else {
            alert('No se pudo crear la carpeta.');
        }
    } catch (err) {
        alert('Error de red al crear la carpeta.');
    }
}

// --- OBSERVACIONES (Almacenamiento Frontend Rápido) ---
function guardarObservacionLocal(idArchivo, texto) {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    if (texto.trim() === '') {
        localStorage.removeItem(`obs_${idArchivo}`);
    } else {
        localStorage.setItem(`obs_${idArchivo}`, `(${usuarioLogueado.nombre}) ${texto}`);
    }
    renderizarDirectorioActual(); // Refresca para mostrar el nombre del autor
}


// --- FUNCIONES ADMIN PARA CARPETAS ---
async function renombrarCarpeta(id, nombreActual) {
    const nuevoNombre = prompt('Ingresa el nuevo nombre para la carpeta:', nombreActual);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre === nombreActual) return;
    try {
        const res = await fetch(`/api/elementos/${id}/renombrar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nuevoNombre: nuevoNombre.trim() }) });
        const data = await res.json();
        if (data.success) cargarElementos();
    } catch (err) { alert('Error de red al renombrar.'); }
}

async function eliminarCarpeta(id, nombre) {
    if (confirm(`¿Estás seguro de eliminar la carpeta "${nombre}"? Nota: Google Drive requiere que esté vacía.`)) {
        try {
            const res = await fetch(`/api/elementos/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) cargarElementos();
            else alert('No se pudo eliminar. Asegúrate de que la carpeta esté vacía.');
        } catch (err) { alert('Error de red al eliminar.'); }
    }
}

// --- BLOQUEOS Y REEMPLAZO DE ARCHIVOS ---
async function bloquearArchivo(id, linkDescarga) {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    await fetch(`/api/archivos/${id}/bloquear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: usuarioLogueado.nombre }) });
    if(linkDescarga) window.open(linkDescarga, '_blank');
    cargarElementos();
}

async function desbloquearArchivo(id) {
    if(confirm('¿Forzar desbloqueo del archivo?')) {
        await fetch(`/api/archivos/${id}/desbloquear`, { method: 'POST' });
        cargarElementos();
    }
}

async function eliminarArchivo(id) {
    if (confirm('¿Estás seguro de eliminar este documento?')) {
        await fetch(`/api/elementos/${id}`, { method: 'DELETE' });
        cargarElementos();
    }
}

async function reemplazarArchivo(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('archivo', file);
        alert('Subiendo archivo actualizado... (El duplicado es intencional aquí)');
        await fetch(`/api/archivos/${id}`, { method: 'PUT', body: formData });
        cargarElementos();
    };
    input.click();
}

// --- WIDGET CLIMA LAJA (Octava Región) ---
async function cargarClimaLaja() {
    const widget = document.getElementById('widgetClimaLaja');
    if(!widget) return;
    widget.style.display = 'block';

    // Reloj en vivo
    setInterval(() => {
        const now = new Date();
        document.getElementById('horaLocal').textContent = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    // Consulta satelital coordenadas Laja (Lat: -37.2833, Lon: -72.7)
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-37.28&longitude=-72.70&current_weather=true');
        const data = await res.json();
        const temp = data.current_weather.temperature;
        document.getElementById('climaInfo').textContent = `☁️ ${temp}°C - Actual`;
    } catch(e) {
        document.getElementById('climaInfo').textContent = 'Clima no disponible';
    }
}

// --- CHAT CORPORATIVO INTERNO ---
function toggleChat() {
    const cuerpo = document.getElementById('cuerpoChat');
    const btn = document.getElementById('btnMinimizarChat');
    if (cuerpo.style.display === 'none') {
        cuerpo.style.display = 'flex';
        btn.textContent = '−';
    } else {
        cuerpo.style.display = 'none';
        btn.textContent = '+';
    }
}

function initChat() {
    const chatWidget = document.getElementById('chatCorporativo');
    if(chatWidget) chatWidget.style.display = 'flex';

    const formChat = document.getElementById('formChat');
    if(formChat) {
        formChat.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('inputChat');
            if(!input.value.trim()) return;

            const usuario = JSON.parse(localStorage.getItem('usuarioPehuen'));
            const mensaje = { autor: usuario.nombre, texto: input.value, hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) };

            // Guarda el chat localmente para sincronizar entre pestañas
            let historial = JSON.parse(localStorage.getItem('chatPehuen_historial')) || [];
            historial.push(mensaje);
            localStorage.setItem('chatPehuen_historial', JSON.stringify(historial));

            input.value = '';
            renderizarChat();
        });
    }

    // Sincronización en vivo si otro ingeniero escribe en otra pestaña
    window.addEventListener('storage', (e) => {
        if(e.key === 'chatPehuen_historial') renderizarChat();
    });

    renderizarChat();
}

function renderizarChat() {
    const container = document.getElementById('mensajesChat');
    if(!container) return;
    
    const historial = JSON.parse(localStorage.getItem('chatPehuen_historial')) || [];
    container.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 11px; margin-bottom: 10px;">Chat Interno - Encriptado</div>';
    
    historial.forEach(m => {
        container.innerHTML += `
            <div style="margin-bottom: 8px; line-height: 1.2;">
                <span style="font-weight: bold; color: #0284c7;">${m.autor}</span> 
                <span style="font-size:10px; color:#94a3b8;">(${m.hora})</span><br>
                <span style="color: #334155;">${m.texto}</span>
            </div>`;
    });
    container.scrollTop = container.scrollHeight; // Auto-scroll al final
}

// --- GESTIÓN DE USUARIOS ---
async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const usuarios = await res.json();
    const lista = document.getElementById('listaUsuarios');
    lista.innerHTML = '';
    usuarios.forEach(u => {
        lista.innerHTML += `<tr>
            <td>${u.nombre}</td><td>${u.email}</td><td>${u.rol.toUpperCase()}</td>
            <td><button onclick="eliminarUser(${u.id})" style="background:red; color:white; padding:2px 5px; border:none; cursor:pointer; font-weight: bold;">X</button></td>
        </tr>`;
    });
}

async function eliminarUser(id) {
    if(confirm('¿Estás seguro de revocar el acceso a este usuario?')) {
        await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
        cargarUsuarios();
    }
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}
