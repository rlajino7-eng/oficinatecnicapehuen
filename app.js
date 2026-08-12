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
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('usuarioPehuen', JSON.stringify(data.usuario));
                mostrarApp(data.usuario);
            } else {
                document.getElementById('loginError').textContent = data.error;
            }
        } catch (err) {
            document.getElementById('loginError').textContent = 'Error de conexión con el servidor';
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
                } else {
                    alert('Error al subir: ' + data.error);
                }
            } catch (err) {
                alert('Error al conectar con el servidor');
            }
            btn.textContent = '⬆ Subir a Drive';
        });

        document.getElementById('archivoInput').addEventListener('change', (e) => {
            const fileName = e.target.files[0] ? e.target.files[0].name : 'Ningún archivo...';
            document.getElementById('nombreSeleccionado').textContent = fileName;
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
                lista.innerHTML += `
                    <tr>
                        <td><strong>${a.categoria}</strong></td>
                        <td><a href="${a.webViewLink}" target="_blank" style="color: #004080; font-weight: 500; text-decoration: none;">${a.name}</a></td>
                        <td>${a.createdTime ? new Date(a.createdTime).toLocaleDateString() + ' ' + new Date(a.createdTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Reciente'}</td>
                        <td>
                            <button onclick="reemplazarArchivo('${a.id}')" style="background: #0284c7; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-size: 12px;">Actualizar</button>
                            <button onclick="eliminarArchivo('${a.id}')" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>
                        </td>
                    </tr>`;
            }
        });
    } catch (err) {
        console.error('Error cargando archivos', err);
    }
}

async function eliminarArchivo(id) {
    if (confirm('¿Estás seguro de eliminar este documento del Drive corporativo?')) {
        const res = await fetch(`/api/archivos/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            cargarArchivos();
        } else {
            alert('No se pudo eliminar el archivo.');
        }
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

        alert('Subiendo archivo actualizado a Drive...');
        const res = await fetch(`/api/archivos/${id}`, { method: 'PUT', body: formData });
        const data = await res.json();
        if (data.success) {
            alert('¡Archivo actualizado correctamente!');
            cargarArchivos();
        } else {
            alert('Error al actualizar el archivo.');
        }
    };
    input.click();
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}
