document.addEventListener('DOMContentLoaded', () => {
    verificarSesion();

    // 1. INICIAR SESIÓN
    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('emailLogin').value;
        const password = document.getElementById('passLogin').value;
        const errorMsg = document.getElementById('loginError');

        errorMsg.textContent = "";

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (data.success) {
                // Guardamos el usuario en el navegador
                localStorage.setItem('pehuen_user', JSON.stringify(data.usuario));
                verificarSesion();
            } else {
                errorMsg.textContent = data.error;
            }
        } catch (e) {
            errorMsg.textContent = "Error al intentar conectar con el servidor.";
        }
    });

    // 2. INPUT DE SELECCIÓN PARA SUBIR ARCHIVOS
    document.getElementById('archivoInput').addEventListener('change', (e) => {
        const nombre = e.target.files[0] ? e.target.files[0].name : "Ningún archivo...";
        document.getElementById('nombreSeleccionado').textContent = nombre;
    });

    // 3. SUBIR ARCHIVO A DRIVE
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

    // 4. AGREGAR NUEVO TRABAJADOR / USUARIO
    document.getElementById('formUsuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombreUser').value;
        const email = document.getElementById('emailUser').value;
        const password = document.getElementById('passUser').value;
        const rol = document.getElementById('rolUser').value;

        const res = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol })
        });
        const data = await res.json();
        if (data.success) {
            renderUsuarios(data.usuarios);
            document.getElementById('formUsuario').reset();
            document.getElementById('passUser').value = "pehuen123"; // valor por defecto
        }
    });
});

// VERIFICA SI HAY UN USUARIO CONECTADO
function verificarSesion() {
    const userGuardado = localStorage.getItem('pehuen_user');
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');

    if (!userGuardado) {
        // No ha iniciado sesión -> Mostrar login, ocultar sistema
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    } else {
        // Usuario conectado -> Ocultar login, mostrar sistema de archivos
        const usuario = JSON.parse(userGuardado);
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';

        // Poner su rol en la barra superior
        document.getElementById('badgeUsuario').textContent = `${usuario.nombre} (${usuario.rol.toUpperCase()})`;

        // Si es el ADMINISTRADOR, mostramos el botón de gestión de usuarios
        if (usuario.rol === 'admin') {
            document.getElementById('btnAdmin').style.display = 'inline-block';
        } else {
            document.getElementById('btnAdmin').style.display = 'none';
        }

        // Cargar las tablas
        cargarArchivosDrive();
        cargarUsuarios();
    }
}

// CERRAR SESIÓN
function cerrarSesion() {
    localStorage.removeItem('pehuen_user');
    verificarSesion();
}

// CARGAR ARCHIVOS DESDE GOOGLE DRIVE
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
