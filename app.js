let todosLosElementos = [];
let historialRuta = [{ id: '', nombre: 'Directorio Principal' }];
let chatModoActual = 'general';
let usuarioDestinoPrivado = '';
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

function toggleChat() {
    const c = document.getElementById('cuerpoChat'); 
    const panel = document.getElementById('panelColegas');
    const b = document.getElementById('btnMinimizarChat');
    if (c.style.display === 'none') { 
        c.style.display = 'flex'; 
        if(chatModoActual === 'privado') panel.style.display = 'flex';
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
    chatModoActual = modo;
    const panel = document.getElementById('panelColegas');
    const btnGen = document.getElementById('btnTabGeneral');
    const btnPriv = document.getElementById('btnTabPrivado');
    
    if (modo === 'general') {
        panel.style.display = 'none';
        btnGen.style.background = '#0284c7';
        btnPriv.style.background = '#475569';
        usuarioDestinoPrivado = '';
    } else {
        if(chatAbierto) panel.style.display = 'flex';
        btnGen.style.background = '#475569';
        btnPriv.style.background = '#0284c7';
        actualizarListaColegasLateral();
    }
    cargarChatNube();
}

function actualizarListaColegasLateral() {
    const listaDiv = document.getElementById('listaColegasLateral');
    if(!listaDiv) return;
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    fetch('/api/usuarios')
        .then(res => res.json())
        .then(usuarios => {
            listaDiv.innerHTML = '';
            usuarios.forEach(u => {
                if (u.nombre !== usuarioLogueado.nombre) {
                    const online = u.ultimoAcceso && (Date.now() - new Date(u.ultimoAcceso).getTime() < 120000);
                    const puntoHtml = online ? '<span style="color:#22c55e; font-size:14px; margin-right:6px;" title="Conectado">●</span>' : '<span style="display:inline-block; width:10px; margin-right:6px;"></span>';
                    const estiloSeleccionado = usuarioDestinoPrivado === u.nombre ? 'background: #e2e8f0; font-weight: bold;' : '';
                    
                    listaDiv.innerHTML += `<div onclick="seleccionarColegaDirecto('${u.nombre}')" style="padding: 6px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; margin-bottom: 2px; ${estiloSeleccionado}" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${usuarioDestinoPrivado === u.nombre ? '#e2e8f0' : 'transparent'}'">${puntoHtml}<span style="color: #334155; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${u.nombre}</span></div>`;
                }
            });
        });
}

function seleccionarColegaDirecto(nombreColega) {
    usuarioDestinoPrivado = nombreColega;
    chatModoActual = 'privado';
    actualizarListaColegasLateral();
    cargarChatNube();
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
            const destinario = chatModoActual === 'general' ? 'general' : usuarioDestinoPrivado;
            
            if (chatModoActual === 'privado' && !destinario) {
                alert('Por favor haz clic en un colega de la lista lateral para escribirle por privado.');
                return;
            }

            const msg = { 
                autor: usuarioLogueado.nombre, 
                destinario: destinario, 
                texto: i.value, 
                hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) 
            };

            i.value = 'Enviando...'; i.disabled = true;
            await fetch('/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(msg) });
            i.value = ''; i.disabled = false; i.focus(); 
            cargarChatNube();
        });
    }

    // Enviar latido activo cada 30 segundos
    setInterval(() => {
        const u = JSON.parse(localStorage.getItem('usuarioPehuen'));
        if(u) fetch(`/api/usuarios/latido`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ nombre: u.nombre }) }).catch(e=>{});
    }, 30000);

    cargarChatNube(); 
    setInterval(() => {
        cargarChatNube();
        if(chatAbierto && chatModoActual === 'privado') actualizarListaColegasLateral();
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
                    audio.play().catch(e => console.log('El navegador bloqueó el audio automático', e));
                }
            }
        }
        cantidadMensajesUltimaVez = historial.length;

        const c = document.getElementById('mensajesChat'); if(!c) return;
        
        c.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:11px; margin-bottom:8px;">${chatModoActual === 'general' ? '🌐 Chat Empresa (General)' : '🔒 Privado con ' + (usuarioDestinoPrivado || 'Selecciona un colega')}</div>`;
        
        historial.forEach(m => {
            const colorAutor = obtenerColorAutor(m.autor);
            let estadoVisto = m.visto ? '<span style="color:#0284c7; font-size:10px; font-weight:bold;">✓✓</span>' : '<span style="color:#94a3b8; font-size:10px;">✓</span>';
            
            if (chatModoActual === 'general') {
                if (m.destinario === 'general' || !m.destinario) {
                    c.innerHTML += `<div style="margin-bottom:8px; line-height:1.2;"><span style="font-weight:bold; color:${colorAutor};">${m.autor}</span> <span style="font-size:10px; color:#94a3b8;">(${m.hora})</span><br><span style="color:#334155;">${m.texto}</span> <span style="float:right;">${m.autor === usuarioLogueado.nombre ? estadoVisto : ''}</span></div>`;
                }
            } else {
                if (usuarioDestinoPrivado && ((m.autor === usuarioLogueado.nombre && m.destinario === usuarioDestinoPrivado) || (m.autor === usuarioDestinoPrivado && m.destinario === usuarioLogueado.nombre))) {
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
