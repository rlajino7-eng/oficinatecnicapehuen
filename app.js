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
            document.getElementById('loginError').textContent = 'Error de conexión';
        }
    });

    const formSubir = document.getElementById('formSubir');
    if (formSubir) {
        formSubir.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('archivoInput');
            if (!input.files[0]) return;

            const carpetaActualId = historialRuta[historialRuta.length - 1].id;
            const formData = new FormData();
            formData.append('archivo', input.files[0]);
            formData.append('parentId', carpetaActualId);

            const btn = formSubir.querySelector('.btn-upload');
            btn.textContent = 'Subiendo...';
            try {
                const res = await fetch('/api/subir', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    input.value = '';
                    document.getElementById('nombreSeleccionado').textContent = 'Ningún archivo...';
                    cargarElementos();
                } else alert('Error: ' + data.error);
            } catch (err) { alert('Error de red'); }
            btn.textContent = '⬆ Subir aquí';
        });

        document.getElementById('archivoInput').addEventListener('change', (e) => {
            document.getElementById('nombreSeleccionado').textContent = e.target.files[0] ? e.target.files[0].name : 'Ningún archivo...';
        });
    }

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
                    alert('Usuario agregado correctamente.');
                    formUsuario.reset();
                    document.getElementById('passUser').value = 'pehuen123';
                    cargarUsuarios();
                }
            } catch (error) { alert('Error al agregar usuario.'); }
        });
    }
});

function mostrarApp(usuario) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('badgeUsuario').textContent = `${usuario.nombre} (${usuario.rol.toUpperCase()})`;
    if (usuario.rol === 'admin') {
        document.getElementById('btnAdmin').style.display = 'inline-block';
        cargarUsuarios();
    }
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
    } catch (err) { console.error('Error cargando elementos', err); }
}

function renderizarDirectorioActual() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const carpetaActual = historialRuta[historialRuta.length - 1];
    
    document.getElementById('tituloDirectorio').textContent = `📁 ${carpetaActual.nombre}`;
    
    const btnVolver = document.getElementById('btnVolverAtras');
    if (historialRuta.length > 1) {
        btnVolver.style.display = 'inline-block';
    } else {
        btnVolver.style.display = 'none';
    }

    const grilla = document.getElementById('grillaDirectorio');
    const contenedorTabla = document.getElementById('contenedorTablaArchivos');
    const listaArchivos = document.getElementById('listaArchivosCarpeta');

    grilla.innerHTML = '';
    listaArchivos.innerHTML = '';

    let elementosEnNivel = [];
    if(carpetaActual.id === '') {
        const idsPrimarios = todosLosElementos.filter(e => e.esCarpeta).map(e => e.parentId);
        const raizIdReal = idsPrimarios[0] || ''; 
        elementosEnNivel = todosLosElementos.filter(e => e.parentId === raizIdReal || e.parentId === '');
    } else {
        elementosEnNivel = todosLosElementos.filter(e => e.parentId === carpetaActual.id);
    }

    const carpetasFiltradas = elementosEnNivel.filter(e => e.esCarpeta);
    const archivosFiltrados = elementosEnNivel.filter(e => !e.esCarpeta);

    // Dibujar Tarjetas de Carpetas con botones de Admin si corresponde
    if (carpetasFiltradas.length === 0 && archivosFiltrados.length === 0) {
        grilla.innerHTML = '<p style="color: #64748b; grid-column: 1/-1;">Esta carpeta está vacía.</p>';
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

        archivosFiltrados.forEach(a => {
            const estaEnUso = a.estado === 'EN_USO';
            const esDueño = a.bloqueadoPor === usuarioLogueado.nombre;
            const esAdmin = usuarioLogueado.rol === 'admin';
            
            let etiquetaEstado = estaEnUso ? `<span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🔒 En uso por ${a.bloqueadoPor}</span>` : '';
            
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

            listaArchivos.innerHTML += `
                <tr>
                    <td><strong>${a.categoria}</strong></td>
                    <td>
                        <a href="${a.webViewLink}" target="_blank" style="color: #004080; font-weight: 500; text-decoration: none;">${a.name}</a><br>
                        ${etiquetaEstado}
                    </td>
                    <td>${a.createdTime ? new Date(a.createdTime).toLocaleDateString() : 'Reciente'}</td>
                    <td>${botones}</td>
                </tr>`;
        });
    } else {
        contenedorTabla.style.display = 'none';
    }
}

function entrarCarpeta(id, nombre) {
    historialRuta.push({ id: id, nombre: nombre });
    renderizarDirectorioActual();
}

function subirNivelCarpeta() {
    if (historialRuta.length > 1) {
        historialRuta.pop();
        renderizarDirectorioActual();
    }
}

async function crearCarpetaActual() {
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
            alert('¡Carpeta creada correctamente!');
            cargarElementos();
        } else {
            alert('No se pudo crear la carpeta.');
        }
    } catch (err) {
        alert('Error de red al crear la carpeta.');
    }
}

// --- NUEVO: FUNCIONES DE ADMIN PARA CARPETAS ---
async function renombrarCarpeta(id, nombreActual) {
    const nuevoNombre = prompt('Ingresa el nuevo nombre para la carpeta:', nombreActual);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre === nombreActual) return;

    try {
        const res = await fetch(`/api/elementos/${id}/renombrar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevoNombre: nuevoNombre.trim() })
        });
        const data = await res.json();
        if (data.success) {
            alert('Carpeta renombrada con éxito.');
            cargarElementos();
        } else {
            alert('No se pudo renombrar la carpeta.');
        }
    } catch (err) {
        alert('Error de red al renombrar.');
    }
}

async function eliminarCarpeta(id, nombre) {
    if (confirm(`¿Estás seguro de eliminar la carpeta "${nombre}"? Nota: Google Drive requiere que la carpeta esté vacía para eliminarla.`)) {
        try {
            const res = await fetch(`/api/elementos/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                alert('Carpeta eliminada.');
                cargarElementos();
            } else {
                alert('No se pudo eliminar. Asegúrate de que la carpeta esté vacía.');
            }
        } catch (err) {
            alert('Error de red al eliminar.');
        }
    }
}

async function bloquearArchivo(id, linkDescarga) {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    await fetch(`/api/archivos/${id}/bloquear`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ usuario: usuarioLogueado.nombre }) 
    });
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
        alert('Subiendo archivo actualizado...');
        await fetch(`/api/archivos/${id}`, { method: 'PUT', body: formData });
        cargarElementos();
    };
    input.click();
}

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
    if(confirm('¿Estás seguro de revocar el acceso?')) {
        await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
        cargarUsuarios();
    }
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}
