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

let driveCache = [];
let usuariosAutorizados = [];
let chatHistorial = [];
let idArchivoUsuarios = null;
let idArchivoChat = null;

async function cargarUsuariosDesdeDrive() {
    try {
        const res = await drive.files.list({ q: `'${FOLDER_ID}' in parents and name = 'usuarios_pehuen.json' and trashed = false`, fields: 'files(id)' });
        if (res.data.files.length > 0) {
            idArchivoUsuarios = res.data.files[0].id;
            const file = await drive.files.get({ fileId: idArchivoUsuarios, alt: 'media' });
            usuariosAutorizados = file.data;
        } else {
            usuariosAutorizados = [{ id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' }];
            const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify(usuariosAutorizados));
            const newFile = await drive.files.create({ resource: { name: 'usuarios_pehuen.json', parents: [FOLDER_ID] }, media: { mimeType: 'application/json', body: bufferStream }, fields: 'id' });
            idArchivoUsuarios = newFile.data.id;
        }
    } catch (e) { console.error("Error usuarios:", e.message); }
}

async function cargarChatDesdeDrive() {
    try {
        const res = await drive.files.list({ q: `'${FOLDER_ID}' in parents and name = 'chat_pehuen.json' and trashed = false`, fields: 'files(id)' });
        if (res.data.files.length > 0) {
            idArchivoChat = res.data.files[0].id;
            const file = await drive.files.get({ fileId: idArchivoChat, alt: 'media' });
            chatHistorial = file.data || [];
        } else {
            const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify([]));
            const newFile = await drive.files.create({ resource: { name: 'chat_pehuen.json', parents: [FOLDER_ID] }, media: { mimeType: 'application/json', body: bufferStream }, fields: 'id' });
            idArchivoChat = newFile.data.id;
        }
    } catch (e) { console.error("Error chat:", e.message); }
}

async function guardarUsuariosEnDrive() {
    if (!idArchivoUsuarios) return;
    const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify(usuariosAutorizados));
    await drive.files.update({ fileId: idArchivoUsuarios, media: { mimeType: 'application/json', body: bufferStream } });
}

async function guardarChatEnDrive() {
    if (!idArchivoChat) return;
    const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify(chatHistorial));
    await drive.files.update({ fileId: idArchivoChat, media: { mimeType: 'application/json', body: bufferStream } });
}

async function refrescarCache() {
    try {
        const response = await drive.files.list({
            q: `trashed = false and name != 'usuarios_pehuen.json' and name != 'chat_pehuen.json'`,
            fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, parents, properties, size)',
            orderBy: 'createdTime desc'
        });
        driveCache = response.data.files.map(f => ({
            ...f,
            esCarpeta: f.mimeType === 'application/vnd.google-apps.folder',
            parentId: f.parents && f.parents[0] ? f.parents[0] : FOLDER_ID,
            categoria: f.name.includes('_') ? f.name.split('_')[0].toUpperCase() : 'GENERAL',
            estado: f.properties?.estado || 'DISPONIBLE',
            bloqueadoPor: f.properties?.bloqueadoPor || '',
            observacion: f.properties?.observacion || ''
        }));
    } catch (error) { console.error('Error caché:', error.message); }
}

cargarUsuariosDesdeDrive().then(() => cargarChatDesdeDrive()).then(() => refrescarCache());
setInterval(refrescarCache, 5 * 60 * 1000);

app.get('/api/chat', (req, res) => res.json(chatHistorial));
app.post('/api/chat', async (req, res) => {
    chatHistorial.push(req.body);
    if(chatHistorial.length > 200) chatHistorial.shift();
    await guardarChatEnDrive();
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const usuario = usuariosAutorizados.find(u => u.email === email && u.password === password);
  if (usuario) res.json({ success: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  else res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
});
app.get('/api/usuarios', (req, res) => res.json(usuariosAutorizados));
app.post('/api/usuarios', async (req, res) => {
  usuariosAutorizados.push({ id: Date.now(), ...req.body });
  await guardarUsuariosEnDrive();
  res.json({ success: true });
});
app.delete('/api/usuarios/:id', async (req, res) => {
  usuariosAutorizados = usuariosAutorizados.filter(u => u.id != req.params.id);
  await guardarUsuariosEnDrive();
  res.json({ success: true });
});

app.post('/api/carpetas', async (req, res) => {
  try {
    const { nombre, parentId } = req.body;
    const carpetaPadre = parentId && parentId.trim() !== '' ? parentId : FOLDER_ID;
    const check = await drive.files.list({ q: `'${carpetaPadre}' in parents and name = '${nombre}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields: 'files(id)' });
    if (check.data.files.length > 0) return res.json({ success: true });
    await drive.files.create({ resource: { name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [carpetaPadre] }, fields: 'id' });
    await refrescarCache(); res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/elementos', (req, res) => res.json(driveCache));

// SUBIDA SEGURA EN SUBCARPETAS
app.post('/api/subir', upload.array('archivos', 20), async (req, res) => {
  try {
    const targetFolderId = req.body.parentId && req.body.parentId.trim() !== '' ? req.body.parentId : FOLDER_ID;
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, error: 'Sin archivos' });
    
    const uploadedFiles = [];
    for (const file of req.files) {
        const check = await drive.files.list({ q: `'${targetFolderId}' in parents and name = '${file.originalname}' and trashed = false`, fields: 'files(id)' });
        if (check.data.files.length > 0) { uploadedFiles.push({ name: file.originalname, status: 'duplicado' }); continue; }
        const bufferStream = new stream.PassThrough(); bufferStream.end(file.buffer);
        await drive.files.create({ resource: { name: file.originalname, parents: [targetFolderId] }, media: { mimeType: file.mimetype, body: bufferStream } });
        uploadedFiles.push({ name: file.originalname, status: 'ok' });
    }
    await refrescarCache(); 
    res.json({ success: true, files: uploadedFiles });
  } catch (error) { 
    console.error("Error en subida:", error.message);
    res.status(500).json({ success: false, error: error.message }); 
  }
});

app.delete('/api/elementos/:id', async (req, res) => { try { await drive.files.delete({ fileId: req.params.id }); await refrescarCache(); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.put('/api/elementos/:id/renombrar', async (req, res) => { try { await drive.files.update({ fileId: req.params.id, resource: { name: req.body.nuevoNombre } }); await refrescarCache(); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/api/archivos/:id/bloquear', async (req, res) => { try { await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: 'EN_USO', bloqueadoPor: req.body.usuario } } }); await refrescarCache(); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/api/archivos/:id/desbloquear', async (req, res) => { try { await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: null, bloqueadoPor: null } } }); await refrescarCache(); res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.put('/api/archivos/:id', upload.single('archivo'), async (req, res) => {
  try {
    const bufferStream = new stream.PassThrough(); bufferStream.end(req.file.buffer);
    await drive.files.update({ fileId: req.params.id, media: { mimeType: req.file.mimetype, body: bufferStream }, resource: { properties: { estado: null, bloqueadoPor: null } } });
    await refrescarCache(); res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});
app.put('/api/elementos/:id/observacion', async (req, res) => {
  try {
    await drive.files.update({ fileId: req.params.id, resource: { properties: { observacion: req.body.observacion || null } } });
    await refrescarCache(); res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
