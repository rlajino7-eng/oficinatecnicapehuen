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
            const formData = new FormData();
            formData.append('archivo', input.files[0]);
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
            btn.textContent = '⬆ Subir a Drive';
        });

        document.getElementById('archivoInput').addEventListener('change', (e) => {
            document.getElementById('nombreSeleccionado').textContent = e.target.files[0] ? e.target.files[0].name : 'Ningún archivo...';
        });
    }
});

function mostrarApp(usuario) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('badgeUsuario').textContent = `${usuario.nombre} (${usuario.rol.toUpperCase()})`;
    if (usuario.rol === 'admin') {
        document.getElementById('btnAdmin').style.display = 'inline-block';
        cargarUsuarios(); // Faltaba esto antes, ahora está aquí seguro.
    }
    cargarArchivos();
}

function cerrarSesion() {
    localStorage.removeItem('usuarioPehuen');
    location.reload();
}

async function cargarArchivos() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    try {
        const res = await fetch('/api/archivos');
        const archivos = await res.json();
        const filtro = document.getElementById('filtroCategoria').value;
        const lista = document.getElementById('listaArchivos');
        lista.innerHTML = '';

        if (archivos.length === 0) {
            lista.innerHTML = '<tr><td colspan="4" class="loading">No hay documentos en el repositorio.</td></tr>';
            return;
        }

        archivos.forEach(a => {
            if (filtro === 'TODOS' || a.categoria === filtro) {
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
                    botones += `<button onclick="bloquearArchivo('${a.id}', '${a.webContentLink}')" style="background: #eab308; color: black; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-size: 12px; font-weight: bold;">Bloquear para editar</button>`;
                    botones += `<button onclick="eliminarArchivo('${a.id}')" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>`;
                }

                lista.innerHTML += `
                    <tr>
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
    } catch (err) { console.error('Error cargando archivos', err); }
}

async function bloquearArchivo(id, linkDescarga) {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioPehuen'));
    await fetch(`/api/archivos/${id}/bloquear`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ usuario: usuarioLogueado.nombre }) 
    });
    // Abrir la descarga en otra pestaña
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

// Funciones de Usuarios (Mantenerlas para que no se tranque el login de admin)
async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const usuarios = await res.json();
    const lista = document.getElementById('listaUsuarios');
    lista.innerHTML = '';
    usuarios.forEach(u => {
        lista.innerHTML += `<tr>
            <td>${u.nombre}</td><td>${u.email}</td><td>${u.rol.toUpperCase()}</td>
            <td><button onclick="eliminarUser(${u.id})" style="background:red; color:white; padding:2px 5px; border:none; cursor:pointer;">X</button></td>
        </tr>`;
    });
}
function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}
