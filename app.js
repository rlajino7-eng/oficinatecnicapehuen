let todosLosArchivos = [];

document.addEventListener('DOMContentLoaded', () => {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    if (!usuarioLogueado) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    } else {
        mostrarApp(usuarioLogueado);
    }

    // --- LÓGICA DE INICIO DE SESIÓN ---
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

    // --- LÓGICA DE SUBIDA DE ARCHIVOS ---
    const formSubir = document.getElementById('formSubir');
    if (formSubir) {
        formSubir.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('archivoInput');
            const inputCarpeta = document.getElementById('inputCarpetaNueva').value;

            if (!input.files[0]) return;
            const formData = new FormData();
            formData.append('archivo', input.files[0]);
            formData.append('carpeta', inputCarpeta.trim());

            const btn = formSubir.querySelector('.btn-upload');
            btn.textContent = 'Subiendo...';
            try {
                const res = await fetch('/api/subir', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    input.value = '';
                    document.getElementById('nombreSeleccionado').textContent = 'Ningún archivo...';
                    cargarArchivos();
                } else alert('Error: ' + data.error);
            } catch (err) { alert('Error de red'); }
            btn.textContent = '⬆ Subir';
        });

        document.getElementById('archivoInput').addEventListener('change', (e) => {
            document.getElementById('nombreSeleccionado').textContent = e.target.files[0] ? e.target.files[0].name : 'Ningún archivo...';
        });
    }

    // --- NUEVO: LÓGICA PARA CREAR USUARIOS DESDE EL MODAL ---
    const formUsuario = document.getElementById('formUsuario');
    if (formUsuario) {
        formUsuario.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evita que la página se recargue
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
                    document.getElementById('passUser').value = 'pehuen123'; // Reinicia la pass por defecto
                    cargarUsuarios(); // Actualiza la tablita de abajo
                }
            } catch (error) {
                alert('Error al conectar con el servidor para agregar usuario.');
            }
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
    cargarArchivos();
}

function cerrarSesion() {
    localStorage.removeItem('usuarioPehuen');
    location.reload();
}

async function cargarArchivos() {
    try {
        const res = await fetch('/api/archivos');
        todosLosArchivos = await res.json();
        actualizarSelectoresCarpetas(todosLosArchivos);
        renderizarTabla();
    } catch (err) { console.error('Error cargando archivos', err); }
}

function actualizarSelectoresCarpetas(archivos) {
    const carpetasUnicas = new Set();
    archivos.forEach(a => carpetasUnicas.add(a.carpeta));

    const selectorVisor = document.getElementById('filtroCarpetaVisor');
    const dataListSubida = document.getElementById('listaCarpetas');
    
    const seleccionActual = selectorVisor.value;

    selectorVisor.innerHTML = '<option value="TODAS">Todos los Proyectos</option>';
    dataListSubida.innerHTML = '';

    carpetasUnicas.forEach(carpeta => {
        selectorVisor.innerHTML += `<option value="${carpeta}">${carpeta}</option>`;
        dataListSubida.innerHTML += `<option value="${carpeta}">`;
    });

    if(carpetasUnicas.has(seleccionActual)) {
        selectorVisor.value = seleccionActual;
    }
}

function renderizarTabla() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    const filtroTipo = document.getElementById('filtroCategoria').value;
    const filtroCarpeta = document.getElementById('filtroCarpetaVisor').value;
    const lista = document.getElementById('listaArchivos');
    lista.innerHTML = '';

    if (todosLosArchivos.length === 0) {
        lista.innerHTML = '<tr><td colspan="5" class="loading">No hay documentos en el repositorio.</td></tr>';
        return;
    }

    todosLosArchivos.forEach(a => {
        const cumpleTipo = (filtroTipo === 'TODOS' || a.categoria === filtroTipo);
        const cumpleCarpeta = (filtroCarpeta === 'TODAS' || a.carpeta === filtroCarpeta);

        if (cumpleTipo && cumpleCarpeta) {
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

            lista.innerHTML += `
                <tr>
                    <td><span style="background:#e2e8f0; padding: 3px 8px; border-radius: 4px; color: #334155; font-size: 13px;">📁 ${a.carpeta}</span></td>
                    <td><strong>${a.categoria}</strong></td>
                    <td>
                        <a href="${a.webViewLink}" target="_blank" style="color: #004080; font-weight: 500; text-decoration: none;">${a.name}</a><br>
                        ${etiquetaEstado}
                    </td>
                    <td>${a.createdTime ? new Date(a.createdTime).toLocaleDateString() : 'Reciente'}</td>
                    <td>${botones}</td>
                </tr>`;
        }
    });
}

async function bloquearArchivo(id, linkDescarga) {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    await fetch(`/api/archivos/${id}/bloquear`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ usuario: usuarioLogueado.nombre }) 
    });
    if(linkDescarga) window.open(linkDescarga, '_blank');
    cargarArchivos();
}

async function desbloquearArchivo(id) {
    if(confirm('¿Forzar desbloqueo del archivo?')) {
        await fetch(`/api/archivos/${id}/desbloquear`, { method: 'POST' });
        cargarArchivos();
    }
}

async function eliminarArchivo(id) {
    if (confirm('¿Estás seguro de eliminar este documento del Drive corporativo?')) {
        await fetch(`/api/archivos/${id}`, { method: 'DELETE' });
        cargarArchivos();
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
        alert('Subiendo archivo actualizado y desbloqueando...');
        await fetch(`/api/archivos/${id}`, { method: 'PUT', body: formData });
        cargarArchivos();
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

// --- NUEVO: FUNCIÓN PARA ELIMINAR USUARIO ---
async function eliminarUser(id) {
    if(confirm('¿Estás seguro de que quieres revocar el acceso a este usuario?')) {
        await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
        cargarUsuarios(); // Recarga la tabla para que el usuario desaparezca visualmente
    }
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}
