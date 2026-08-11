// Dentro de tu función que dibuja la tabla:
// Suponiendo que 'a' es el archivo que viene del servidor
let categoria = a.name.includes('_') ? a.name.split('_')[0] : 'GENERAL';

listaArchivos.innerHTML += `
    <tr>
        <td>${categoria}</td>
        <td><a href="${a.webViewLink}" target="_blank">${a.name}</a></td>
        <td>${a.createdTime ? new Date(a.createdTime).toLocaleDateString() : '-'}</td>
        <td>
            <button onclick="reemplazar('${a.id}')" class="btn-edit">Actualizar</button>
            <button onclick="eliminar('${a.id}')" class="btn-del" style="background:red; color:white;">Eliminar</button>
        </td>
    </tr>`;

// Funciones nuevas para el app.js:
async function eliminar(id) {
    if(confirm('¿Eliminar este documento del servidor?')) {
        await fetch(`/api/archivos/${id}`, { method: 'DELETE' });
        cargarArchivos(); // Recarga la tabla
    }
}

async function reemplazar(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        const formData = new FormData();
        formData.append('archivo', e.target.files[0]);
        await fetch(`/api/archivos/${id}`, { method: 'PUT', body: formData });
        cargarArchivos();
    };
    input.click();
}
