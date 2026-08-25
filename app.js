let todosLosElementos = [];
let historialRuta = [{ id: '', nombre: 'Directorio Principal' }];
let chatModoActual = 'general';
let usuarioDestinoPrivado = '';
let cantidadMensajesUltimaVez = 0;
let chatAbierto = false;
let todosLosAnuncios = [];

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
    
    // AMPLIACIÓN DE CARGOS EN EL SELECTOR DE ROLES DEL FORMULARIO (INCLUYENDO PREVENCIÓN)
    const selectRol = document.getElementById('rolUser');
    if (selectRol && selectRol.options.length <= 2) {
        selectRol.innerHTML = `
            <option value="admin">Administrador</option>
            <option value="ingeniero">Ingeniero</option>
            <option value="prevencion">Prevención</option>
            <option value="secretario/a">Secretario/a</option>
            <option value="gerencia">Gerencia</option>
            <option value="compras">Compras</option>
            <option value="planificacion">Planificación</option>
            <option value="control calidad">Control Calidad</option>
            <option value="general">General</option>
        `;
    }

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
    
    // Intentamos cargar anuncios de forma aislada para que jamás bloquee el login si falta algún componente visual
    try { cargarAnunciosSeguro(); } catch(err) { console.error("Aviso anuncios:", err); }
}

function cerrarSesion() { localStorage.removeItem('usuarioPehuen'); location.reload(); }
async function cargarElementos() { const res = await fetch('/api/elementos'); todosLosElementos = await res.json(); renderizarDirectorioActual(); }

// FUNCIÓN SEGURA PARA EL TABLÓN DE ANUNCIOS (CON PUBLICACIÓN, EDICIÓN Y ELIMINACIÓN)
async function cargarAnunciosSeguro() {
    try {
        const res = await fetch('/api/anuncios');
        if (!res.ok) return;
        const anuncios = await res.json();
        todosLosAnuncios = Array.isArray(anuncios) ? anuncios : [];
        
        let contenedorTablon = document.getElementById('tablonAnunciosContainer');
        const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));

        if (!contenedorTablon) {
            contenedorTablon = document.createElement('div');
            contenedorTablon.id = 'tablonAnunciosContainer';
            contenedorTablon.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
            
            const seccionPrincipal = document.querySelector('main') || document.getElementById('mainApp');
            if (seccionPrincipal) {
                seccionPrincipal.prepend(contenedorTablon);
            }
        }

        const esAutorizado = usuarioLogueado && (usuarioLogueado.rol === 'admin' || usuarioLogueado.rol === 'gerencia');

        let htmlAdminBtn = esAutorizado ? 
            `<button onclick="abrirModalAnuncioSeguro()" style="background:#0284c7; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold;">📢 Publicar Nuevo Anuncio</button>` : '';

        let htmlAnuncios = todosLosAnuncios.map(a => `
            <div style="background:white; border-left:4px solid #0284c7; padding:10px 15px; margin-bottom:10px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <strong style="color:#0f172a; font-size:14px;">📌 ${a.autor || 'Administración'}</strong>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:#64748b; font-size:11px;">${a.fecha || ''}</span>
                        ${esAutorizado ? `
                            <button onclick="editarAnuncioSeguro('${a.id}')" style="background:#0284c7; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:11px;" title="Editar anuncio">✏️</button>
                            <button onclick="eliminarAnuncioSeguro('${a.id}')" style="background:#dc2626; color:white; border:none; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:11px;" title="Eliminar anuncio">🗑️</button>
                        ` : ''}
                    </div>
                </div>
                <p style="color:#334155; font-size:13px; margin:0; line-height:1.4;">${a.texto || ''}</p>
            </div>
        `).join('');

        contenedorTablon.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h2 style="margin:0; font-size:16px; color:#1e293b;">📋 Tablón de Anuncios y Comunicados</h2>
                ${htmlAdminBtn}
            </div>
            <div style="max-height: 200px; overflow-y: auto;">
                ${htmlAnuncios || '<p style="color:#64748b; font-size:13px;">No hay anuncios publicados.</p>'}
            </div>
        `;
    } catch (e) {
        console.error('Error cargando anuncios:', e);
    }
}

function abrirModalAnuncioSeguro() {
    const textoAnuncio = prompt('Escribe el comunicado o anuncio oficial para el equipo:');
    if (!textoAnuncio || !textoAnuncio.trim()) return;
    
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    
    fetch('/api/anuncios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autor: usuarioLogueado.nombre, texto: textoAnuncio.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('¡Anuncio publicado con éxito!');
            cargarAnunciosSeguro();
        } else {
            alert('Error al publicar anuncio.');
        }
    })
    .catch(err => alert('Error de red al publicar.'));
}

async function editarAnuncioSeguro(id) {
    const anuncio = todosLosAnuncios.find(a => a.id == id);
    const textoActual = anuncio ? anuncio.texto : '';
    const nuevoTexto = prompt('Editar el contenido del anuncio:', textoActual);
    if (nuevoTexto !== null && nuevoTexto.trim() !== '' && nuevoTexto.trim() !== textoActual) {
        try {
            const res = await fetch(`/api/anuncios/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: nuevoTexto.trim() })
            });
            const data = await res.json();
            if (data.success || res.ok) {
                alert('Anuncio actualizado.');
                cargarAnunciosSeguro();
            } else {
                alert('Error al actualizar el anuncio.');
            }
        } catch (err) {
            alert('Error de red al editar el anuncio.');
        }
    }
}

async function eliminarAnuncioSeguro(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este anuncio?')) {
        try {
            const res = await fetch(`/api/anuncios/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success || res.ok) {
                alert('Anuncio eliminado.');
                cargarAnunciosSeguro();
            } else {
                alert('Error al eliminar anuncio.');
            }
        } catch (err) {
            alert('Error de red al eliminar el anuncio.');
        }
    }
}

function renderizarDirectorioActual() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const carpetaActual = historialRuta[historialRuta.length - 1];
    document.getElementById('tituloDirectorio').textContent = `📁 ${carpetaActual.nombre}`;
    
    const navDisp = historialRuta.length > 1 ? 'inline-block' : 'none';
    document.getElementById('btnVolverAtras').style.display = navDisp; document.getElementById('btnHome').style.display = navDisp;

    const grilla = document.getElementById('grillaDirectorio'); const lista = document.getElementById('listaArchivosCarpeta');
    grilla.innerHTML = ''; lista.innerHTML = '';
    const buscador = document.getElementById('inputBuscador') ? document.getElementById('inputBuscador').value.toLowerCase() : '';

    // LEER PREFERENCIA DE VISTA DEL USUARIO
    const vistaPreferida = localStorage.getItem('vistaPreferidaPehuen') || 'cuadricula';
    if (vistaPreferida === 'lista') {
        grilla.style.display = 'flex';
        grilla.style.flexDirection = 'column';
        grilla.style.gap = '8px';
    } else {
        grilla.style.display = 'grid';
        grilla.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
        grilla.style.gap = '20px';
    }

    let elementos = carpetaActual.id === '' 
        ? todosLosElementos.filter(e => e.esRaiz) 
        : todosLosElementos.filter(e => e.parentId === carpetaActual.id);

    let carpetas = elementos.filter(e => e.esCarpeta); 
    let archivos = elementos.filter(e => !e.esCarpeta);

    // FILTRO DE PRIVACIDAD CORREGIDO: Solo oculta carpetas si empiezan exactamente con "PERSONAL -" o "PRIVADO -"
    carpetas = carpetas.filter(c => {
        const nombreCarpetaUpper = c.name.toUpperCase();
        if (nombreCarpetaUpper.startsWith('PERSONAL') || nombreCarpetaUpper.startsWith('PRIVADO')) {
            if (!nombreCarpetaUpper.includes(usuarioLogueado.nombre.toUpperCase())) {
                return false;
            }
        }
        return true;
    });
    
    if (buscador) { carpetas = carpetas.filter(c => c.name.toLowerCase().includes(buscador)); archivos = archivos.filter(a => a.name.toLowerCase().includes(buscador)); }
    if (document.getElementById('contadorArchivos')) document.getElementById('contadorArchivos').textContent = `(${archivos.length} archivos)`;

    if (carpetas.length === 0 && archivos.length === 0) { grilla.innerHTML = `<p style="color: #64748b;">${buscador ? 'Sin resultados.' : 'Esta ubicación está vacía.'}</p>`; }
    else {
        carpetas.forEach(c => {
            const btns = usuarioLogueado.rol === 'admin' ? `<div style="display:flex; justify-content:flex-end; gap:5px;" onclick="event.stopPropagation()"><button onclick="renombrarCarpeta('${c.id}', '${c.name}')" style="background:#0284c7;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;" title="Renombrar">✏️</button><button onclick="eliminarCarpeta('${c.id}', '${c.name}')" style="background:#dc2626;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;" title="Eliminar">🗑️</button></div>` : '';
            
            if (vistaPreferida === 'lista') {
                grilla.innerHTML += `<div onclick="entrarCarpeta('${c.id}', '${c.name}')" style="background:white; border:1px solid #cbd5e1; border-radius:6px; padding:10px 15px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor='#0284c7'" onmouseout="this.style.borderColor='#cbd5e1'"><div style="display:flex; align-items:center; gap:10px;"><span style="font-size:24px;">📁</span><div><h3 style="margin:0; color:#1e293b; font-size:15px;">${c.name}</h3><p style="color:#64748b; font-size:12px; margin:0;">Carpeta</p></div></div><div>${btns}</div></div>`;
            } else {
                grilla.innerHTML += `<div class="folder-card" onclick="entrarCarpeta('${c.id}', '${c.name}')"><div class="folder-icon">📁</div><h3>${c.name}</h3><p>Carpeta</p>${btns ? `<div style="margin-top:10px; display:flex; justify-content:center; gap:5px;" onclick="event.stopPropagation()">${btns}</div>` : ''}</div>`;
            }
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

// FUNCIÓN BLOQUEAR ARCHIVO CON AVISO AL CHAT GENERAL
async function bloquearArchivo(id, l) { 
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const archivoObj = todosLosElementos.find(e => e.id === id);
    const nombreArchivo = archivoObj ? archivoObj.name : 'un archivo';

    let nombreCarpeta = 'Directorio Principal';
    if (archivoObj && archivoObj.parentId) {
        const carpetaObj = todosLosElementos.find(e => e.id === archivoObj.parentId);
        if (carpetaObj) nombreCarpeta = carpetaObj.name;
    }

    try {
        await fetch(`/api/archivos/${id}/bloquear`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ usuario: usuarioLogueado.nombre }) 
        });

        const textoAviso = `🔒 ${usuarioLogueado.nombre} está usando el archivo "${nombreArchivo}" (ubicado en la carpeta: ${nombreCarpeta}).`;
        const mensajeAviso = {
            autor: usuarioLogueado.nombre,
            destinario: 'general',
            texto: textoAviso,
            hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        };

        await fetch('/api/chat', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(mensajeAviso) 
        });
    } catch (err) {
        console.error('Error al bloquear o enviar aviso al chat', err);
    }

    if(l) window.open(l, '_blank'); 
    cargarElementos(); 
}

// FUNCIÓN DESBLOQUEAR ARCHIVO CON AVISO AL CHAT GENERAL
async function desbloquearArchivo(id) { 
    if(confirm('¿Forzar desbloqueo?')) {
        const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
        const archivoObj = todosLosElementos.find(e => e.id === id);
        const nombreArchivo = archivoObj ? archivoObj.name : 'un archivo';

        let nombreCarpeta = 'Directorio Principal';
        if (archivoObj && archivoObj.parentId) {
            const carpetaObj = todosLosElementos.find(e => e.id === archivoObj.parentId);
            if (carpetaObj) nombreCarpeta = carpetaObj.name;
        }

        try {
            await fetch(`/api/archivos/${id}/desbloquear`, { method: 'POST' });

            const textoAviso = `🔓 ${usuarioLogueado.nombre} dejó de trabajar en el archivo "${nombreArchivo}" (ubicado en la carpeta: ${nombreCarpeta}). Ya se encuentra desbloqueado.`;
            const mensajeAviso = {
                autor: usuarioLogueado.nombre,
                destinario: 'general',
                texto: textoAviso,
                hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
            };

            await fetch('/api/chat', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(mensajeAviso) 
            });
        } catch (err) {
            console.error('Error al desbloquear o enviar aviso al chat', err);
        }

        cargarElementos(); 
    }
}

async function eliminarArchivo(id) { if (confirm('¿Eliminar documento?')) { await fetch(`/api/elementos/${id}`, { method: 'DELETE' }); cargarElementos(); } }

// FUNCIÓN REEMPLAZAR/MODIFICAR ARCHIVO CON AVISO DE DESBLOQUEO AL CHAT GENERAL
async function reemplazarArchivo(id) { 
    const i = document.createElement('input'); 
    i.type = 'file'; 
    i.onchange = async(e) => { 
        if(e.target.files[0]) { 
            const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
            const archivoObj = todosLosElementos.find(e => e.id === id);
            const nombreArchivo = archivoObj ? archivoObj.name : 'un archivo';

            let nombreCarpeta = 'Directorio Principal';
            if (archivoObj && archivoObj.parentId) {
                const carpetaObj = todosLosElementos.find(e => e.id === archivoObj.parentId);
                if (carpetaObj) nombreCarpeta = carpetaObj.name;
            }

            const fd = new FormData(); 
            fd.append('archivo', e.target.files[0]); 
            alert('Subiendo reemplazo...'); 
            
            try {
                await fetch(`/api/archivos/${id}`, { method: 'PUT', body: fd });

                const textoAviso = `🔓 ${usuarioLogueado.nombre} dejó de trabajar en el archivo "${nombreArchivo}" (ubicado en la carpeta: ${nombreCarpeta}) y subió su modificación. Ya se encuentra desbloqueado.`;
                const mensajeAviso = {
                    autor: usuarioLogueado.nombre,
                    destinario: 'general',
                    texto: textoAviso,
                    hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                };

                await fetch('/api/chat', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(mensajeAviso) 
                });
            } catch(err) {
                console.error('Error al reemplazar archivo o enviar aviso', err);
            }

            cargarElementos(); 
        } 
    }; 
    i.click(); 
}

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
    const badge = document.getElementById('badgeNotifChat');

    if (c.style.display === 'none') { 
        c.style.display = 'flex'; 
        if(chatModoActual === 'privado') panel.style.display = 'flex';
        b.textContent = '−'; 
        chatAbierto = true;
        
        if (badge) {
            badge.style.display = 'none'; 
            badge.textContent = '¡Nuevo!';
        }
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
    
    // HACER TODA LA BARRA DEL CHAT CLICKEABLE PARA ABRIR O CERRAR
    const tituloBarra = document.getElementById('tituloChatBarra');
    if (tituloBarra) {
        const headerBar = tituloBarra.parentElement.parentElement;
        headerBar.style.cursor = 'pointer';
        headerBar.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.id !== 'btnMinimizarChat') {
                toggleChat();
            }
        };
    }

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
                let esParaMi = false;
                if (!ultimoMsg.destinario || ultimoMsg.destinario === 'general') {
                    esParaMi = true; 
                } else if (ultimoMsg.destinario === usuarioLogueado.nombre) {
                    esParaMi = true; 
                }

                if (esParaMi) {
                    const badge = document.getElementById('badgeNotifChat');
                    if (badge) {
                        badge.style.display = 'inline-block';
                        badge.textContent = `¡De ${ultimoMsg.autor}!`; 
                    }
                    const audio = document.getElementById('audioNotificacion');
                    if (audio) {
                        audio.play().catch(e => console.log('El navegador bloqueó el audio automático', e));
                    }
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

// GESTIÓN DE USUARIOS CON SCROLL, CARGOS Y BOTÓN DE EDICIÓN
async function cargarUsuarios() {
    const usrs = await (await fetch('/api/usuarios')).json(); 
    const l = document.getElementById('listaUsuarios'); 
    if (!l) return;
    
    const contenedorTabla = l.closest('div') || l.parentElement;
    if (contenedorTabla) {
        contenedorTabla.style.maxHeight = '350px';
        contenedorTabla.style.overflowY = 'auto';
        contenedorTabla.style.overflowX = 'auto';
    }

    l.innerHTML = '';
    usrs.forEach(u => {
        const online = u.ultimoAcceso && (Date.now() - new Date(u.ultimoAcceso).getTime() < 120000);
        const indicadorConectado = online ? ' <span style="color:#22c55e; font-weight:bold;">● En línea</span>' : '';
        l.innerHTML += `<tr>
            <td>${u.nombre}${indicadorConectado}</td>
            <td>${u.email}</td>
            <td>${u.rol.toUpperCase()}</td>
            <td style="display:flex; gap:5px;">
                <button onclick="editarUser(${u.id}, '${u.nombre}', '${u.email}', '${u.rol}')" style="background:#0284c7; color:white; padding:2px 6px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;" title="Editar usuario">✏️</button>
                <button onclick="eliminarUser(${u.id})" style="background:red; color:white; padding:2px 6px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;" title="Eliminar acceso">X</button>
            </td>
        </tr>`;
    });
}

// FUNCIÓN PARA EDITAR USUARIOS CON MENÚ DE SELECCIÓN DE ROL
async function editarUser(id, nombreActual, emailActual, rolActual) {
    const nuevoNombre = prompt('Editar Nombre:', nombreActual);
    if (nuevoNombre === null) return;
    const nuevoEmail = prompt('Editar Correo:', emailActual);
    if (nuevoEmail === null) return;

    const rolesDisponibles = ['admin', 'ingeniero', 'prevencion', 'secretario/a', 'gerencia', 'compras', 'planificacion', 'control calidad', 'general'];
    const rolPromptTexto = `Selecciona el número del nuevo rol:\n\n` + rolesDisponibles.map((r, i) => `${i + 1}. ${r}`).join('\n') + `\n\n(Rol actual: ${rolActual})`;
    
    const seleccionRol = prompt(rolPromptTexto);
    if (seleccionRol === null) return;

    let nuevoRol = rolActual;
    const indexRol = parseInt(seleccionRol) - 1;
    if (!isNaN(indexRol) && rolesDisponibles[indexRol]) {
        nuevoRol = rolesDisponibles[indexRol];
    } else if (rolesDisponibles.includes(seleccionRol.trim().toLowerCase())) {
        nuevoRol = seleccionRol.trim().toLowerCase();
    } else {
        alert('Selección de rol no válida. Se mantendrá el rol anterior.');
        return;
    }

    try {
        const res = await fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nuevoNombre.trim(), email: nuevoEmail.trim(), rol: nuevoRol })
        });
        const data = await res.json();
        if (data.success || res.ok) {
            alert('Usuario actualizado con éxito.');
            cargarUsuarios();
        } else {
            alert('Error al actualizar usuario: ' + (data.error || 'Desconocido'));
        }
    } catch (err) {
        alert('Error de red al intentar editar el usuario.');
    }
}

async function eliminarUser(id) { if(confirm('¿Revocar acceso?')) { await fetch(`/api/usuarios/${id}`, { method: 'DELETE' }); cargarUsuarios(); } }
function toggleAdminModal() { const m = document.getElementById('adminModal'); m.style.display = m.style.display === 'flex' ? 'none' : 'flex'; }

// --- CAMBIO DE VISTA (CUADRÍCULA O LISTA) ---
function cambiarVistaUsuario(tipo) {
    localStorage.setItem('vistaPreferidaPehuen', tipo);
    renderizarDirectorioActual();
}
