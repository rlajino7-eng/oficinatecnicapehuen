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

// Usuarios fijos y seguros (evita que el servidor falle al reiniciarse)
let usuariosAutorizados = [
  { id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' },
  { id: 2, email: 'ingeniero1@pehuen.cl', password: 'pehuen123', rol: 'ingeniero', nombre: 'Ingeniero Montaje' }
];

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const usuario = usuariosAutorizados.find(u => u.email === email && u.password === password);
  if (usuario) res.json({ success: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  else res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos' });
});

app.get('/api/usuarios', (req, res) => res.json(usuariosAutorizados));
app.post('/api/usuarios', (req, res) => {
  const { nombre, email, rol, password } = req.body;
  usuariosAutorizados.push({ id: Date.now(), nombre, email, password: password || 'pehuen123', rol: rol || 'ingeniero' });
  res.json({ success: true, usuarios: usuariosAutorizados });
});
app.delete('/api/usuarios/:id', (req, res) => {
  usuariosAutorizados = usuariosAutorizados.filter(u => u.id != req.params.id);
  res.json({ success: true, usuarios: usuariosAutorizados });
});

// CREAR CARPETA
app.post('/api/carpetas', async (req, res) => {
  try {
    const { nombre, parentId } = req.body;
    const nombreCarpeta = nombre ? nombre.trim() : '';
    const carpetaPadre = parentId ? parentId : FOLDER_ID;

    if (!nombreCarpeta) return res.status(400).json({ success: false, error: 'Nombre vacío' });

    const createFolder = await drive.files.create({
      resource: {
        name: nombreCarpeta,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [carpetaPadre]
      },
      fields: 'id, name, parents'
    });

    res.json({ success: true, folder: createFolder.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// LISTAR ELEMENTOS (Carpetas y Archivos para la Web)
app.get('/api/elementos', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, parents, properties)',
      orderBy: 'createdTime desc'
    });

    const allFiles = response.data.files;
    const elementos = allFiles.map(f => ({
      ...f,
      esCarpeta: f.mimeType === 'application/vnd.google-apps.folder',
      parentId: f.parents && f.parents[0] ? f.parents[0] : FOLDER_ID,
      categoria: f.name.includes('_') ? f.name.split('_')[0].toUpperCase() : 'GENERAL',
      estado: f.properties?.estado || 'DISPONIBLE',
      bloqueadoPor: f.properties?.bloqueadoPor || ''
    }));

    res.json(elementos);
  } catch (error) {
    res.status(500).json({ error: 'Error conectando a Google Drive' });
  }
});

// SUBIR ARCHIVO
app.post('/api/subir', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Sin archivo' });
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    
    const targetFolderId = req.body.parentId ? req.body.parentId : FOLDER_ID;

    const file = await drive.files.create({
      resource: { 
          name: req.file.originalname, 
          parents: [targetFolderId],
          properties: { estado: 'DISPONIBLE' }
      },
      media: { mimeType: req.file.mimetype, body: bufferStream },
      fields: 'id, name, webViewLink, parents'
    });

    res.json({ success: true, file: file.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ELIMINAR ARCHIVO O CARPETA
app.delete('/api/elementos/:id', async (req, res) => {
  try {
    await drive.files.delete({ fileId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'No se pudo eliminar el elemento' });
  }
});

// RENOMBRAR ARCHIVO O CARPETA
app.put('/api/elementos/:id/renombrar', async (req, res) => {
  try {
    const { nuevoNombre } = req.body;
    if (!nuevoNombre || !nuevoNombre.trim()) return res.status(400).json({ success: false, error: 'Nombre inválido' });

    const file = await drive.files.update({
      fileId: req.params.id,
      resource: { name: nuevoNombre.trim() }
    });
    res.json({ success: true, file: file.data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'No se pudo renombrar' });
  }
});

app.post('/api/archivos/:id/bloquear', async (req, res) => {
  try {
    await drive.files.update({
      fileId: req.params.id,
      resource: { properties: { estado: 'EN_USO', bloqueadoPor: req.body.usuario } }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/archivos/:id/desbloquear', async (req, res) => {
  try {
    await drive.files.update({
      fileId: req.params.id,
      resource: { properties: { estado: null, bloqueadoPor: null } }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

app.put('/api/archivos/:id', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Sin archivo nuevo' });
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    const file = await drive.files.update({
      fileId: req.params.id,
      media: { mimeType: req.file.mimetype, body: bufferStream },
      resource: { properties: { estado: null, bloqueadoPor: null } }
    });
    res.json({ success: true, file: file.data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'No se pudo reemplazar' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
