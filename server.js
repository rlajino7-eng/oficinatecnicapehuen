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

// FUNCIÓN PARA CREAR CARPETA PERSONAL AUTOMÁTICA EN DRIVE
async function crearCarpetaPersonalSiNoExiste(nombreUsuario) {
    try {
        const nombreCarpeta = `Personal - ${nombreUsuario}`;
        const check = await drive.files.list({ 
            q: `'${FOLDER_ID}' in parents and name = '${nombreCarpeta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, 
            fields: 'files(id)' 
        });
        if (check.data.files.length === 0) {
            await drive.files.create({ 
                resource: { name: nombreCarpeta, mimeType: 'application/vnd.google-apps.folder', parents: [FOLDER_ID] }, 
                fields: 'id' 
            });
            await refrescarCache();
        }
    } catch (e) {
        console.error("Error al crear carpeta personal:", e.message);
    }
}

// CACHÉ ROBUSTA CON LÍMITE AMPLIADO (1000 archivos)
async function refrescarCache() {
    try {
        const response = await drive.files.list({
            q: `trashed = false and name != 'usuarios_pehuen.json' and name != 'chat_pehuen.json'`,
            fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, parents, properties, size)',
            orderBy: 'createdTime desc',
            pageSize: 1000
        });
        driveCache = response.data.files.map(f => {
            const pId = f.parents && f.parents[0] ? f.parents[0] : FOLDER_ID;
            return {
                ...f,
                esCarpeta: f.mimeType === 'application/vnd.google-apps.folder',
                parentId: pId,
                esRaiz: pId === FOLDER_ID,
                categoria: f.name.includes('_') ? f.name.split('_')[0].toUpperCase() : 'GENERAL',
                estado: f.properties?.estado || 'DISPONIBLE',
                bloqueadoPor: f.properties?.bloqueadoPor || '',
                observacion: f.properties?.observacion || ''
            };
        });
    } catch (error) { console.error('Error caché:', error.message); }
}

cargarUsuariosDesdeDrive().then(() => cargarChatDesdeDrive()).then(() => refrescarCache());
setInterval(refrescarCache, 5 * 60 * 1000);

app.get('/api/chat', (req, res) => res.json(chatHistorial));
app.post('/api/chat', async (req, res) => {
    // Al recibir un mensaje, marcamos como visto si pertenece al chat abierto actual o general
    const nuevoMsg = { ...req.body, visto: true };
    chatHistorial.push(nuevoMsg);
    if(chatHistorial.length > 200) chatHistorial.shift();
    await guardarChatEnDrive();
    res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const usuario = usuariosAutorizados.find(u => u.email === email && u.password === password);
  if (usuario) {
      // Registramos la sesión activa al hacer login de forma exitosa
      usuario.ultimoAcceso = new Date().toISOString();
      guardarUsuariosEnDrive().catch(e => {});
      await crearCarpetaPersonalSiNoExiste(usuario.nombre);
      res.json({ success: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } else {
      res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
  }
});

app.get('/api/usuarios', (req, res) => res.json(usuariosAutorizados));

app.post('/api/usuarios', async (req, res) => {
  const nuevoUser = { id: Date.now(), ...req.body };
  usuariosAutorizados.push(nuevoUser);
  await guardarUsuariosEnDrive();
  await crearCarpetaPersonalSiNoExiste(nuevoUser.nombre);
  res.json({ success: true });
});

// NUEVA RUTA: Editar un usuario existente y guardarlo en Google Drive
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { nombre, email, rol } = req.body;
    const usuario = usuariosAutorizados.find(u => u.id == req.params.id);
    
    if (usuario) {
      const nombreAnterior = usuario.nombre;
      if (nombre) usuario.nombre = nombre;
      if (email) usuario.email = email;
      if (rol) usuario.rol = rol;
      
      await guardarUsuariosEnDrive();
      if (nombre && nombre !== nombreAnterior) {
          await crearCarpetaPersonalSiNoExiste(nombre);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  usuariosAutorizados = usuariosAutorizados.filter(u => u.id != req.params.id);
  await guardarUsuariosEnDrive();
  res.json({ success: true });
});

// NUEVO: Latido para mantener actualizado el estado "en línea" al navegar
app.post('/api/usuarios/latido', async (req, res) => {
    const { nombre } = req.body;
    const usr = usuariosAutorizados.find(u => u.nombre === nombre);
    if (usr) {
        usr.ultimoAcceso = new Date().toISOString();
        await guardarUsuariosEnDrive();
    }
    res.json({ success: true });
});

app.post('/api/carpetas', async (req, res) => {
  try {
    const { nombre, parentId } = req.body;
    const carpetaPadre = parentId && parentId.trim() !== '' ? parentId : FOLDER_ID;
    const check = await drive.files.list({ q: `'${carpetaPadre}' in parents and name = '${nombre}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, fields: 'files(id)' });
    if (check.data.files.length > 0) return res.json({ success: true });
    await drive.files.create({ resource: { name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [carpetaPadre] }, fields: 'id' });
    try { await refrescarCache(); } catch(e) {}
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/elementos', (req, res) => res.json(driveCache));

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
    
    try { await refrescarCache(); } catch(e) { console.error("Aviso caché subida:", e.message); }
    
    res.json({ success: true, files: uploadedFiles });
  } catch (error) { 
    res.status(500).json({ success: false, error: error.message }); 
  }
});

app.delete('/api/elementos/:id', async (req, res) => { try { await drive.files.delete({ fileId: req.params.id }); try { await refrescarCache(); } catch(e){} res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.put('/api/elementos/:id/renombrar', async (req, res) => { try { await drive.files.update({ fileId: req.params.id, resource: { name: req.body.nuevoNombre } }); try { await refrescarCache(); } catch(e){} res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/api/archivos/:id/bloquear', async (req, res) => { try { await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: 'EN_USO', bloqueadoPor: req.body.usuario } } }); try { await refrescarCache(); } catch(e){} res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.post('/api/archivos/:id/desbloquear', async (req, res) => { try { await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: null, bloqueadoPor: null } } }); try { await refrescarCache(); } catch(e){} res.json({ success: true }); } catch (e) { res.status(500).json({ success: false }); } });
app.put('/api/archivos/:id', upload.single('archivo'), async (req, res) => {
  try {
    const bufferStream = new stream.PassThrough(); bufferStream.end(req.file.buffer);
    await drive.files.update({ fileId: req.params.id, media: { mimeType: req.file.mimetype, body: bufferStream }, resource: { properties: { estado: null, bloqueadoPor: null } } });
    try { await refrescarCache(); } catch(e){}
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});
app.put('/api/elementos/:id/observacion', async (req, res) => {
  try {
    await drive.files.update({ fileId: req.params.id, resource: { properties: { observacion: req.body.observacion || null } } });
    try { await refrescarCache(); } catch(e){}
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
