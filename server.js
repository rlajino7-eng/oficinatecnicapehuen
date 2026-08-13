const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });
const upload = multer({ storage: multer.memoryStorage() });

// --- SISTEMA DE CACHÉ Y SINCRONIZACIÓN (Optimización y Refresco cada 5 min) ---
let driveCache = [];
let usuariosAutorizados = [];
let idArchivoUsuarios = null;

// Cargar usuarios desde Drive para que nunca se pierdan
async function cargarUsuariosDesdeDrive() {
    try {
        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and name = 'usuarios_pehuen.json' and trashed = false`,
            fields: 'files(id)'
        });
        if (res.data.files.length > 0) {
            idArchivoUsuarios = res.data.files[0].id;
            const file = await drive.files.get({ fileId: idArchivoUsuarios, alt: 'media' });
            usuariosAutorizados = file.data;
        } else {
            // Si no existe, lo crea con el Admin por defecto
            usuariosAutorizados = [{ id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' }];
            const bufferStream = new stream.PassThrough();
            bufferStream.end(JSON.stringify(usuariosAutorizados));
            const newFile = await drive.files.create({
                resource: { name: 'usuarios_pehuen.json', parents: [FOLDER_ID] },
                media: { mimeType: 'application/json', body: bufferStream },
                fields: 'id'
            });
            idArchivoUsuarios = newFile.data.id;
        }
    } catch (e) { console.error("Error cargando usuarios:", e.message); }
}

// Guardar cambios de usuarios en Drive
async function guardarUsuariosEnDrive() {
    if (!idArchivoUsuarios) return;
    try {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(JSON.stringify(usuariosAutorizados));
        await drive.files.update({ fileId: idArchivoUsuarios, media: { mimeType: 'application/json', body: bufferStream } });
    } catch (e) { console.error("Error guardando usuarios:", e.message); }
}

// Refrescar caché de archivos para velocidad ultra rápida
async function refrescarCache() {
    try {
        const response = await drive.files.list({
            q: `trashed = false and name != 'usuarios_pehuen.json'`,
            fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, parents, properties)',
            orderBy: 'createdTime desc'
        });
        driveCache = response.data.files.map(f => ({
            ...f,
            esCarpeta: f.mimeType === 'application/vnd.google-apps.folder',
            parentId: f.parents && f.parents[0] ? f.parents[0] : FOLDER_ID,
            categoria: f.name.includes('_') ? f.name.split('_')[0].toUpperCase() : 'GENERAL',
            estado: f.properties?.estado || 'DISPONIBLE',
            bloqueadoPor: f.properties?.bloqueadoPor || ''
        }));
    } catch (error) { console.error('Error actualizando caché:', error.message); }
}

// Iniciar procesos automáticos al prender el servidor
cargarUsuariosDesdeDrive().then(() => refrescarCache());
setInterval(refrescarCache, 5 * 60 * 1000); // Refresca exactamente cada 5 minutos

// --- RUTAS DE USUARIOS ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const usuario = usuariosAutorizados.find(u => u.email === email && u.password === password);
  if (usuario) res.json({ success: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  else res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos' });
});

app.get('/api/usuarios', (req, res) => res.json(usuariosAutorizados));
app.post('/api/usuarios', async (req, res) => {
  const { nombre, email, rol, password } = req.body;
  usuariosAutorizados.push({ id: Date.now(), nombre, email, password: password || 'pehuen123', rol: rol || 'ingeniero' });
  await guardarUsuariosEnDrive();
  res.json({ success: true, usuarios: usuariosAutorizados });
});
app.delete('/api/usuarios/:id', async (req, res) => {
  usuariosAutorizados = usuariosAutorizados.filter(u => u.id != req.params.id);
  await guardarUsuariosEnDrive();
  res.json({ success: true, usuarios: usuariosAutorizados });
});

// --- CREAR CARPETA (Blindado contra congelamientos) ---
app.post('/api/carpetas', async (req, res) => {
  try {
    const { nombre, parentId } = req.body;
    const nombreCarpeta = nombre ? nombre.trim() : '';
    const carpetaPadre = parentId ? parentId : FOLDER_ID;
    if (!nombreCarpeta) return res.status(400).json({ success: false, error: 'Nombre vacío' });

    const check = await drive.files.list({
      q: `'${carpetaPadre}' in parents and name = '${nombreCarpeta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, parents)'
    });
    if (check.data.files.length > 0) return res.json({ success: true, folder: check.data.files[0] });

    const createFolder = await drive.files.create({
      resource: { name: nombreCarpeta, mimeType: 'application/vnd.google-apps.folder', parents: [carpetaPadre] },
      fields: 'id, name, parents, mimeType'
    });
    await refrescarCache(); 
    res.json({ success: true, folder: createFolder.data });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// --- LISTAR ELEMENTOS (Desde el Caché rápido) ---
app.get('/api/elementos', (req, res) => { res.json(driveCache); });

// --- SUBIDA MASIVA Y CONTROL DE DUPLICADOS ---
app.post('/api/subir', upload.array('archivos', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, error: 'Sin archivos' });
    const targetFolderId = req.body.parentId ? req.body.parentId : FOLDER_ID;
    const uploadedFiles = [];
    
    for (const file of req.files) {
        const check = await drive.files.list({
            q: `'${targetFolderId}' in parents and name = '${file.originalname}' and trashed = false`,
            fields: 'files(id)'
        });
        
        if (check.data.files.length > 0) {
            uploadedFiles.push({ name: file.originalname, status: 'duplicado' });
            continue; // Se salta el duplicado para no romper nada
        }

        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);
        const newFile = await drive.files.create({
          resource: { name: file.originalname, parents: [targetFolderId], properties: { estado: 'DISPONIBLE' } },
          media: { mimeType: file.mimetype, body: bufferStream },
          fields: 'id, name'
        });
        uploadedFiles.push({ name: file.originalname, status: 'ok', data: newFile.data });
    }
    
    await refrescarCache();
    res.json({ success: true, files: uploadedFiles });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// --- ACCIONES (Eliminar, Renombrar, Bloquear, Reemplazar) ---
app.delete('/api/elementos/:id', async (req, res) => {
  try { await drive.files.delete({ fileId: req.params.id }); await refrescarCache(); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); }
});

app.put('/api/elementos/:id/renombrar', async (req, res) => {
  try { await drive.files.update({ fileId: req.params.id, resource: { name: req.body.nuevoNombre.trim() } }); await refrescarCache(); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/archivos/:id/bloquear', async (req, res) => {
  try { await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: 'EN_USO', bloqueadoPor: req.body.usuario } } }); await refrescarCache(); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/archivos/:id/desbloquear', async (req, res) => {
  try { await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: null, bloqueadoPor: null } } }); await refrescarCache(); res.json({ success: true }); } catch (error) { res.status(500).json({ success: false }); }
});

app.put('/api/archivos/:id', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Sin archivo' });
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    await drive.files.update({ fileId: req.params.id, media: { mimeType: req.file.mimetype, body: bufferStream }, resource: { properties: { estado: null, bloqueadoPor: null } } });
    await refrescarCache();
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
