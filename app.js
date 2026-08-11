document.addEventListener('DOMContentLoaded', () => {
    cargarArchivosDrive();
    cargarUsuarios();

    // Input de selección para cambiar texto visual
    document.getElementById('archivoInput').addEventListener('change', (e) => {
        const nombre = e.target.files[0] ? e.target.files[0].name : "Ningún archivo...";
        document.getElementById('nombreSeleccionado').textContent = nombre;
    });

    // Subir archivo a la API (y por tanto a Google Drive)
    document.getElementById('formSubir').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('archivoInput');
        if (!input.files[0]) return;

        const formData = new FormData();
        formData.append('archivo', input.files[0]);

        document.getElementById('nombreSeleccionado').textContent = "Subiendo a Drive...";

        try {
            const response = await fetch('/api/subir', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                alert('Documento guardado con éxito en el Drive de Oficina Técnica');
                input.value = '';
                document.getElementById('nombreSeleccionado').textContent = "Ningún archivo...";
                cargarArchivosDrive();
            }
        } catch (error) {
            alert('Error al subir el archivo.');
        }
    });

    // Agregar usuario al panel Admin
    document.getElementById('formUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombreUser').value;
        const email = document.getElementById('emailUser').value;
        const rol = document.getElementById('rolUser').value;

        const res = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, rol })
        });
        const data = await res.json();
        if (data.success) {
            renderUsuarios(data.usuarios);
            document.getElementById('formUsuario').reset();
        }
    });
});

// Cargar tabla de Google Drive
async function cargarArchivosDrive() {
    const tbody = document.getElementById('listaArchivos');
    tbody.innerHTML = '<tr><td colspan="4">Consultando servidor Google Drive Pehuén...</td></tr>';

    try {
        const response = await fetch('/api/archivos');
        const archivos = await response.json();

        tbody.innerHTML = '';
        if (archivos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">La carpeta técnica en Drive está vacía.</td></tr>';
            return;
        }

        archivos.forEach(file => {
            const tipo = obtenerTipoDoc(file.mimeType);
            const fecha = new Date(file.createdTime).toLocaleDateString('es-CL');
            tbody.innerHTML += `
                <tr>
                    <td><strong>${tipo}</strong></td>
                    <td>${file.name}</td>
                    <td>${fecha}</td>
                    <td><a href="${file.webViewLink}" target="_blank" class="btn-view">Abrir / Colaborar</a></td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4">Error de conexión con Google Drive.</td></tr>';
    }
}

function obtenerTipoDoc(mimeType) {
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊 EXCEL';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝 WORD';
    if (mimeType.includes('pdf')) return '📑 PDF';
    return '📁 DOC';
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const data = await res.json();
    renderUsuarios(data);
}

function renderUsuarios(usuarios) {
    const tbody = document.getElementById('listaUsuarios');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td>${u.nombre}</td>
                <td>${u.email}</td>
                <td><strong>${u.rol.toUpperCase()}</strong></td>
                <td><button onclick="eliminarUsuario(${u.id})" class="btn-admin" style="border-color: #E53E3E; color: #E53E3E;">Remover</button></td>
            </tr>
        `;
    });
}

async function eliminarUsuario(id) {
    const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) renderUsuarios(data.usuarios);
}