let todosLosElementos = [];
let historialRuta = [{ id: '', nombre: 'Directorio Principal' }];
let chatModoActual = 'general'; // 'general', 'privado', 'grupo'
let usuarioDestinoPrivado = '';
let grupoDestinoActual = 'General';
let listaGruposEmpresa = ['General', 'Operaciones Laja', 'Mantención Mecánica'];
let cantidadMensajesUltimaVez = 0;
let chatAbierto = false;

// GENERADOR DE COLOR AUTOMÁTICO SEGÚN EL NOMBRE
function obtenerColorAutor(nombre) {
    const colores = ['#0284c7', '#059669', '#d97706', '#7c3aed', '#db2777', '#2563eb', '#ca8a04', '#0d9488'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
}

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    if (!usuarioLogueado) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    } else {
        mostrarApp(usuarioLogueado);
    }

    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailLogin').value;
        const password = document.getElementById('passLogin').value;
        try {
            const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const data = await res.json();
            if (data.success) { localStorage.setItem('usuarioPehuen', JSON.stringify(data.usuario)); mostrarApp(data.usuario); }
            else document.getElementById('loginError').textContent = data.error;
        } catch (err) { document.getElementById('loginError').textContent = 'Error de conexión'; }
    });

    const formSubir = document.getElementById('formSubir');
    if (formSubir) {
        formSubir.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('archivoInput');
            if (input.files.length === 0) return;
            const formData = new FormData();
            for (let i = 0; i < input.files.length; i++) formData.append('archivos', input.files[i]);
            formData.append('parentId', historialRuta[historialRuta.length - 1].id);
            
            const btn = formSubir.querySelector('.btn-upload');
            btn.textContent = 'Subiendo... ⏳'; btn.style.background = '#f59e0b';
            
            try {
                const res = await fetch('/api/subir', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    let msg = 'Resumen:\n';
                    data.files.forEach(f => msg += f.status === 'duplicado' ? `⚠️ DUPLICADO: ${f.name}\n` : `✅ OK: ${f.name}\n`);
                    alert(msg); input.value = ''; document.getElementById('nombreSeleccionado').textContent = 'Ningún archivo...'; cargarElementos();
                } else {
                    alert('Error al subir: ' + (data.error || 'Desconocido'));
                }
            } catch (err) { 
                alert('Error de red al subir los archivos.'); 
            } finally {
                btn.textContent = '⬆ Subir'; 
                btn.style.background = '#16a34a';
            }
        });
        document.getElementById('archivoInput').addEventListener('change', (e) => {
            document.getElementById('nombreSeleccionado').textContent = e.target.files.length > 0 ? `${e.target.files.length} archivo(s)` : 'Ningún archivo...';
        });
    }

    if (document.getElementById('inputBuscador')) document.getElementById('inputBuscador').addEventListener('input', renderizarDirectorioActual);
    
    if (document.getElementById('formUsuario')) {
        document.getElementById('formUsuario').addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = { nombre: document.getElementById('nombreUser').value, email: document.getElementById('emailUser').value, password: document.getElementById('passUser').value, rol: document.getElementById('rolUser').value };
            await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            alert('Usuario agregado.'); document.getElementById('formUsuario').reset(); document.getElementById('passUser').value = 'pehuen123'; cargarUsuarios();
        });
    }
});

function mostrarApp(usuario) {
    document.getElementById('loginScreen').style.display = 'none'; document.getElementById('mainApp').style.display = 'block';
    document.getElementById('badgeUsuario').textContent = `${usuario.nombre} (${usuario.rol.toUpperCase()})`;
    if (usuario.rol === 'admin') { document.getElementById('btnAdmin').style.display = 'inline-block'; cargarUsuarios(); }
    cargarClimaLaja(); initChat(); cargarElementos();
}
function cerrarSesion() { localStorage.removeItem('usuarioPehuen'); location.reload(); }
async function cargarElementos() { const res = await fetch('/api/elementos'); todosLosElementos = await res.json(); renderizarDirectorioActual(); }

function renderizarDirectorioActual() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const carpetaActual = historialRuta[historialRuta.length - 1];
    document.getElementById('tituloDirectorio').textContent = `📁 ${carpetaActual.nombre}`;
    
    const navDisp = historialRuta.length > 1 ? 'inline-block' : 'none';
    document.getElementById('btnVolverAtras').style.display = navDisp; document.getElementById('btnHome').style.display = navDisp;

    const grilla = document.getElementById('grillaDirectorio'); const lista = document.getElementById('listaArchivosCarpeta');
    grilla.innerHTML = ''; lista.innerHTML = '';
    const buscador = document.getElementById('inputBuscador') ? document.getElementById('inputBuscador').value.toLowerCase() : '';

    let elementos = carpetaActual.id === '' 
        ? todosLosElementos.filter(e => e.esRaiz) 
        : todosLosElementos.filter(e => e.parentId === carpetaActual.id);

    let carpetas = elementos.filter(e => e.esCarpeta); 
    let archivos = elementos.filter(e => !e.esCarpeta);
    
    if (buscador) { carpetas = carpetas.filter(c => c.name.toLowerCase().includes(buscador)); archivos = archivos.filter(a => a.name.toLowerCase().includes(buscador)); }
    if (document.getElementById('contadorArchivos')) document.getElementById('contadorArchivos').textContent = `(${archivos.length} archivos)`;

    if (carpetas.length === 0 && archivos.length === 0) { grilla.innerHTML = `<p style="color: #64748b;">${buscador ? 'Sin resultados.' : 'Esta ubicación está vacía.'}</p>`; }
    else {
        carpetas.forEach(c => {
            const btns = usuarioLogueado.rol === 'admin' ? `<div style="margin-top:10px; display:flex; justify-content:center; gap:5px;" onclick="event.stopPropagation()"><button onclick="renombrarCarpeta('${c.id}', '${c.name}')" style="background:#0284c7;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;" title="Renombrar">✏️</button><button onclick="eliminarCarpeta('${c.id}', '${c.name}')" style="background:#dc2626;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;" title="Eliminar">🗑️</button></div>` : '';
            grilla.innerHTML += `<div class="folder-card" onclick="entrarCarpeta('${c.id}', '${c.name}')"><div class="folder-icon">📁</div><h3>${c.name}</h3><p>Carpeta</p>${btns}</div>`;
        });
    }

    if (archivos.length > 0) {
        document.getElementById('contenedorTablaArchivos').style.display = 'block';
        archivos.forEach((a, index) => {
            const enUso = a.estado === 'EN_USO';
            let etiqueta = enUso ? `<span style="background:#f59e0b; color:white; padding:2px 6px; border-radius:4px; font-size:11px;">🔒 En uso por ${a.bloqueadoPor}</span>` : '';
            let botones = enUso ? 
                (((a.bloqueadoPor === usuarioLogueado.nombre) || usuarioLogueado.rol === 'admin') ? `<button onclick="reemplazarArchivo('${a.id}')" style="background:#0284c7;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;margin-right:5px;font-size:12px;">⬆ Modificado</button>` : '') +
                (usuarioLogueado.rol === 'admin' ? `<button onclick="desbloquearArchivo('${a.id}')" style="background:#475569;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;">Desbloquear</button>` : '')
                : `<button onclick="bloquearArchivo('${a.id}', '${a.webContentLink}')" style="background:#eab308;color:black;border:none;padding:6px;border-radius:4px;cursor:pointer;margin-right:5px;font-size:12px;font-weight:bold;">Bloquear</button><button onclick="eliminarArchivo('${a.id}')" style="background:#dc2626;color:white;border:none;padding:6px;border-radius:4px;cursor:pointer;font-size:12px;">Eliminar</button>`;

            let pesoFormat = '-- KB';
            if (a.size) {
                const bytes = parseInt(a.size);
                pesoFormat = bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
            }

            const tipoCarpeta = carpetaActual.nombre === 'Directorio Principal' ? 'RAÍZ' : carpetaActual.nombre.toUpperCase();
            const obsValue = a.observacion || '';
            const inputObs = `<input type="text" value="${obsValue}" placeholder="Añadir nota..." onchange="guardarObservacionServidor('${a.id}', this.value)" style="width: 140px; padding: 4px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 4px;">`;

            lista.innerHTML += `<tr><td style="text-align:center;font-weight:bold;color:#64748b;">${index + 1}</td><td><strong style="color:#475569;">${tipoCarpeta}</strong></td><td><a href="${a.webViewLink}" target="_blank" style="color:#004080;font-weight:500;text-decoration:none;">${a.name}</a><br>${etiqueta}</td><td style="color:#64748b;font-size:12px;white-space:nowrap;">${pesoFormat}</td><td>${a.createdTime ? new Date(a.createdTime).toLocaleDateString() : 'Reciente'}</td><td>${inputObs}</td><td>${botones}</td></tr>`;
        });
    } else document.getElementById('contenedorTablaArchivos').style.display = 'none';
}

function entrarCarpeta(id, nombre) { historialRuta.push({ id, nombre }); if(document.getElementById('inputBuscador')) document.getElementById('inputBuscador').value = ''; renderizarDirectorioActual(); }
function subirNivelCarpeta() { if (historialRuta.length > 1) { historialRuta.pop(); if(document.getElementById('inputBuscador')) document.getElementById('inputBuscador').value = ''; renderizarDirectorioActual(); } }
function irAlInicio() { historialRuta = [{ id: '', nombre: 'Directorio Principal' }]; if(document.getElementById('inputBuscador')) document.getElementById('inputBuscador').value = ''; renderizarDirectorioActual(); }

async function crearCarpetaActual() {
    if (historialRuta.length === 1 && JSON.parse(localStorage.getItem('usuarioPehuen')).rol !== 'admin') { alert('⛔ Solo Administradores pueden crear Carpetas Principales.'); return; }
    const nombre = prompt('Ingresa el nombre:'); if (!nombre || !nombre.trim()) return;
    await fetch('/api/carpetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), parentId: historialRuta[historialRuta.length - 1].id }) });
    cargarElementos();
}

async function renombrarCarpeta(id, actual) { const nuevo = prompt('Nuevo nombre:', actual); if (nuevo && nuevo.trim() !== actual) { await fetch(`/api/elementos/${id}/renombrar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nuevoNombre: nuevo.trim() }) }); cargarElementos(); } }
async function eliminarCarpeta(id, n) { if (confirm(`¿Eliminar "${n}"? Debe estar vacía.`)) { await fetch(`/api/elementos/${id}`, { method: 'DELETE' }); cargarElementos(); } }
async function bloquearArchivo(id, l) { await fetch(`/api/archivos/${id}/bloquear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: JSON.parse(localStorage.getItem('usuarioPehuen')).nombre }) }); if(l) window.open(l, '_blank'); cargarElementos(); }
async function desbloquearArchivo(id) { if(confirm('¿Forzar desbloqueo?')) { await fetch(`/api/archivos/${id}/desbloquear`, { method: 'POST' }); cargarElementos(); } }
async function eliminarArchivo(id) { if (confirm('¿Eliminar documento?')) { await fetch(`/api/elementos/${id}`, { method: 'DELETE' }); cargarElementos(); } }
async function reemplazarArchivo(id) { const i = document.createElement('input'); i.type = 'file'; i.onchange = async(e) => { if(e.target.files[0]) { const fd = new FormData(); fd.append('archivo', e.target.files[0]); alert('Subiendo reemplazo...'); await fetch(`/api/archivos/${id}`, { method: 'PUT', body: fd }); cargarElementos(); } }; i.click(); }

async function guardarObservacionServidor(id, texto) {
    const usr = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const obsFinal = texto.trim() === '' ? '' : `(${usr.nombre}) ${texto}`;
    try { await fetch(`/api/elementos/${id}/observacion`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacion: obsFinal }) }); cargarElementos(); } catch(e) { alert('Error guardando observación'); }
}

async function cargarClimaLaja() {
    const w = document.getElementById('widgetClimaLaja'); if(!w) return; w.style.display = 'block';
    setInterval(() => document.getElementById('horaLocal').textContent = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), 1000);
    try { 
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-37.28&longitude=-72.70&current_weather=true'); 
        const data = await res.json();
        document.getElementById('climaInfo').textContent = `☁️ ${data.current_weather.temperature}°C - Actual`; 
    } catch(e) { 
        document.getElementById('climaInfo').textContent = 'Clima no disp.'; 
    }
}

// --- SISTEMA DE CHAT TIPO WHATSAPP CORPORATIVO ---

function toggleChat() {
    const c = document.getElementById('cuerpoChat'); 
    const panel = document.getElementById('panelColegas');
    const b = document.getElementById('btnMinimizarChat');
    if (c.style.display === 'none') { 
        c.style.display = 'flex'; 
        panel.style.display = 'flex';
        b.textContent = '−'; 
        chatAbierto = true;
        document.getElementById('badgeNotifChat').style.display = 'none'; 
        cargarChatNube(); 
    } else { 
        c.style.display = 'none'; 
        panel.style.display = 'none';
        b.textContent = '+'; 
        chatAbierto = false;
    }
}

function cambiarPestanaChat(modo) {
    chatModoActual = modo; // 'contactos' o 'grupos'
    const btnContactos = document.getElementById('btnTabContactos');
    const btnGrupos = document.getElementById('btnTabGrupos');
    
    if (modo === 'contactos') {
        if(btnContactos) { btnContactos.style.background = '#0284c7'; btnContactos.style.color = 'white'; }
        if(btnGrupos) { btnGrupos.style.background = '#e2e8f0'; btnGrupos.style.color = '#334155'; }
        actualizarListaContactosLateral();
    } else {
        if(btnGrupos) { btnGrupos.style.background = '#0284c7'; btnGrupos.style.color = 'white'; }
        if(btnContactos) { btnContactos.style.background = '#e2e8f0'; btnContactos.style.color = '#334155'; }
        actualizarListaGruposLateral();
    }
}

function actualizarListaContactosLateral() {
    const listaDiv = document.getElementById('listaColegasLateral');
    if(!listaDiv) return;
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    
    // Mostrar botón de crear grupo solo si es administrador
    const adminHeader = document.getElementById('headerPanelChat');
    if(adminHeader) {
        if(usuarioLogueado && usuarioLogueado.rol === 'admin') {
            adminHeader.innerHTML = '<span>👥 Contactos</span> <span onclick="crearNuevoGrupoAdmin()" style="cursor:pointer; font-size:14px; background:#0284c7; padding:2px 6px; border-radius:4px; color:white;" title="Crear Grupo">+ Grupo</span>';
        } else {
            adminHeader.innerHTML = '<span>👥 Contactos</span>';
        }
    }

    fetch('/api/usuarios')
        .then(res => res.json())
        .then(usuarios => {
            listaDiv.innerHTML = '<div style="font-size:10px; color:#64748b; padding:4px; font-weight:bold;">DIRECTOS</div>';
            usuarios.forEach(u => {
                if (u.nombre !== usuarioLogueado.nombre) {
                    const online = u.ultimoAcceso && (Date.now() - new Date(u.ultimoAcceso).getTime() < 120000);
                    const puntoHtml = online ? '<span style="color:#22c55e; font-size:14px; margin-right:6px;" title="En línea">●</span>' : '<span style="display:inline-block; width:10px; margin-right:6px; color:#cbd5e1;">●</span>';
                    const estiloSeleccionado = (chatModoActual === 'privado' && usuarioDestinoPrivado === u.nombre) ? 'background: #e2e8f0; font-weight: bold;' : '';
                    
                    listaDiv.innerHTML += `<div onclick="seleccionarChatPrivado('${u.nombre}')" style="padding: 6px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; margin-bottom: 2px; ${estiloSeleccionado}" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${(chatModoActual === 'privado' && usuarioDestinoPrivado === u.nombre)? '#e2e8f0':'transparent'}'">${puntoHtml}<span style="color: #334155; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.nombre}</span></div>`;
                }
            });
        });
}

function actualizarListaGruposLateral() {
    const listaDiv = document.getElementById('listaColegasLateral');
    if(!listaDiv) return;
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));

    const adminHeader = document.getElementById('headerPanelChat');
    if(adminHeader) {
        if(usuarioLogueado && usuarioLogueado.rol === 'admin') {
            adminHeader.innerHTML = '<span>📢 Grupos</span> <span onclick="crearNuevoGrupoAdmin()" style="cursor:pointer; font-size:14px; background:#0284c7; padding:2px 6px; border-radius:4px; color:white;" title="Crear Grupo">+ Grupo</span>';
        } else {
            adminHeader.innerHTML = '<span>📢 Grupos</span>';
        }
    }

    listaDiv.innerHTML = '<div style="font-size:10px; color:#64748b; padding:4px; font-weight:bold;">CANALES Y GRUPOS</div>';
    listaGruposEmpresa.forEach(grupo => {
        const estiloSeleccionado = (chatModoActual === 'grupo' && grupoDestinoActual === grupo) ? 'background: #e2e8f0; font-weight: bold;' : '';
        listaDiv.innerHTML += `<div onclick="seleccionarChatGrupo('${grupo}')" style="padding: 6px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; margin-bottom: 2px; ${estiloSeleccionado}" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${(chatModoActual === 'grupo' && grupoDestinoActual === grupo)? '#e2e8f0':'transparent'}'"><span style="margin-right:6px; font-size:13px;">💬</span><span style="color: #334155; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${grupo}</span></div>`;
    });
}

function seleccionarChatPrivado(nombreColega) {
    chatModoActual = 'privado';
    usuarioDestinoPrivado = nombreColega;
    grupoDestinoActual = '';
    actualizarListaContactosLateral();
    cargarChatNube();
}

function seleccionarChatGrupo(nombreGrupo) {
    chatModoActual = 'grupo';
    grupoDestinoActual = nombreGrupo;
    usuarioDestinoPrivado = '';
    actualizarListaGruposLateral();
    cargarChatNube();
}

function crearNuevoGrupoAdmin() {
    const nombre = prompt('Ingresa el nombre del nuevo grupo de trabajo:');
    if (!nombre || !nombre.trim()) return;
    if (!listaGruposEmpresa.includes(nombre.trim())) {
        listaGruposEmpresa.push(nombre.trim());
        alert(`¡Grupo "${nombre.trim()}" creado con éxito!`);
        cambiarPestanaChat('grupos');
        seleccionarChatGrupo(nombre.trim());
    } else {
        alert('Este grupo ya existe.');
    }
}

function initChat() {
    const w = document.getElementById('chatCorporativo'); if(w) w.style.display = 'flex';
    const f = document.getElementById('formChat');
    if(f) {
        f.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const i = document.getElementById('inputChat'); 
            if(!i.value.trim()) return;

            const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
            let destinario = 'general';
            if (chatModoActual === 'privado') {
                if (!usuarioDestinoPrivado) { alert('Selecciona un colega de la lista para escribirle.'); return; }
                destinario = usuarioDestinoPrivado;
            } else if (chatModoActual === 'grupo') {
                destinario = 'grupo_' + grupoDestinoActual;
            }

            const msg = { 
                autor: usuarioLogueado.nombre, 
                destinario: destinario, 
                texto: i.value, 
                hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
                visto: false 
            };

            i.value = 'Enviando...'; i.disabled = true;
            await fetch('/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(msg) });
            i.value = ''; i.disabled = false; i.focus(); 
            cargarChatNube();
        });
    }

    // Registrar sesión activa (latido) cada 30 segundos
    const registrarSesionActiva = () => {
        const u = JSON.parse(localStorage.getItem('usuarioPehuen'));
        if(u) {
            fetch(`/api/usuarios/latido`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nombre: u.nombre }) }).catch(e=>{});
        }
    };
    registrarSesionActiva();
    setInterval(registrarSesionActiva, 30000);

    // Iniciar en modo contactos por defecto
    cambiarPestanaChat('contactos');
    cargarChatNube(); 
    setInterval(() => {
        cargarChatNube();
        if(chatAbierto) {
            if(chatModoActual === 'contactos') actualizarListaContactosLateral();
            else if(chatModoActual === 'grupos') actualizarListaGruposLateral();
        }
    }, 4000);
}

async function cargarChatNube() {
    try {
        const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
        const res = await fetch('/api/chat'); 
        const historial = await res.json();
        
        if (historial.length > cantidadMensajesUltimaVez && cantidadMensajesUltimaVez > 0) {
            const ultimoMsg = historial[historial.length - 1];
            if (ultimoMsg.autor !== usuarioLogueado.nombre) {
                document.getElementById('badgeNotifChat').style.display = 'inline-block';
                const audio = document.getElementById('audioNotificacion');
                if (audio) {
                    audio.play().catch(e => console.log('Audio bloqueado por navegador', e));
                }
            }
        }
        cantidadMensajesUltimaVez = historial.length;

        const c = document.getElementById('mensajesChat'); if(!c) return;
        
        let tituloBarraChat = '🌐 Chat General';
        if (chatModoActual === 'privado') tituloBarraChat = '🔒 Privado: ' + (usuarioDestinoPrivado || 'Selecciona contacto');
        else if (chatModoActual === 'grupo') tituloBarraChat = '📢 Grupo: ' + grupoDestinoActual;

        c.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:11px; margin-bottom:8px; font-weight:bold;">${tituloBarraChat}</div>`;
        
        historial.forEach(m => {
            const colorAutor = obtenerColorAutor(m.autor);
            // Tics estilo WhatsApp: ✓ (enviado gris) y ✓✓ (visto en color corporativo #0284c7)
            let estadoVisto = m.visto ? '<span style="color:#0284c7; font-size:11px; font-weight:bold;" title="Visto">✓✓</span>' : '<span style="color:#94a3b8; font-size:11px;" title="Enviado">✓</span>';
            
            if (chatModoActual === 'privado') {
                if (usuarioDestinoPrivado && ((m.autor === usuarioLogueado.nombre && m.destinario === usuarioDestinoPrivado) || (m.autor === usuarioDestinoPrivado && m.destinario === usuarioLogueado.nombre))) {
                    c.innerHTML += `<div style="margin-bottom:8px; line-height:1.2;"><span style="font-weight:bold; color:${colorAutor};">${m.autor}</span> <span style="font-size:10px; color:#94a3b8;">(${m.hora})</span><br><span style="color:#334155;">${m.texto}</span> <span style="float:right;">${m.autor === usuarioLogueado.nombre ? estadoVisto : ''}</span></div>`;
                }
            } else if (chatModoActual === 'grupo') {
                const objetivoGrupo = 'grupo_' + grupoDestinoActual;
                if (m.destinario === objetivoGrupo || (grupoDestinoActual === 'General' && (m.destinario === 'general' || !m.destinario))) {
                    c.innerHTML += `<div style="margin-bottom:8px; line-height:1.2;"><span style="font-weight:bold; color:${colorAutor};">${m.autor}</span> <span style="font-size:10px; color:#94a3b8;">(${m.hora})</span><br><span style="color:#334155;">${m.texto}</span> <span style="float:right;">${m.autor === usuarioLogueado.nombre ? estadoVisto : ''}</span></div>`;
                }
            }
        });
        
        if (chatAbierto) {
            c.scrollTop = c.scrollHeight;
        }
    } catch(e) {}
}

async function cargarUsuarios() {
    const usrs = await (await fetch('/api/usuarios')).json(); const l = document.getElementById('listaUsuarios'); l.innerHTML = '';
    usrs.forEach(u => {
        const online = u.ultimoAcceso && (Date.now() - new Date(u.ultimoAcceso).getTime() < 120000);
        const indicadorConectado = online ? ' <span style="color:#22c55e; font-weight:bold;">● En línea</span>' : '';
        l.innerHTML += `<tr><td>${u.nombre}${indicadorConectado}</td><td>${u.email}</td><td>${u.rol.toUpperCase()}</td><td><button onclick="eliminarUser(${u.id})" style="background:red; color:white; padding:2px 5px; border:none; cursor:pointer; font-weight:bold;">X</button></td></tr>`;
    });
}
async function eliminarUser(id) { if(confirm('¿Revocar acceso?')) { await fetch(`/api/usuarios/${id}`, { method: 'DELETE' }); cargarUsuarios(); } }
function toggleAdminModal() { const m = document.getElementById('adminModal'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; }
