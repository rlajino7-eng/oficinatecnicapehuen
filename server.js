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

// Base de datos de usuarios
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

// LISTAR ARCHIVOS Y SUS CARPETAS
app.get('/api/archivos', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime, properties)',
      orderBy: 'createdTime desc'
    });
    const archivos = response.data.files.map(f => ({
      ...f,
      categoria: f.name.includes('_') ? f.name.split('_')[0].toUpperCase() : 'GENERAL',
      estado: f.properties?.estado || 'DISPONIBLE',
      bloqueadoPor: f.properties?.bloqueadoPor || '',
      carpeta: f.properties?.carpeta || 'General' // <-- Aquí leemos la carpeta
    }));
    res.json(archivos);
  } catch (error) {
    res.status(500).json({ error: 'Error conectando a Google Drive' });
  }
});

// SUBIR ARCHIVO ASIGNÁNDOLE UNA CARPETA
app.post('/api/subir', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Sin archivo' });
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    
    const nombreCarpeta = req.body.carpeta || 'General';

    const file = await drive.files.create({
      resource: { 
          name: req.file.originalname, 
          parents: [FOLDER_ID],
          properties: { carpeta: nombreCarpeta, estado: 'DISPONIBLE' }
      },
      media: { mimeType: req.file.mimetype, body: bufferStream },
      fields: 'id, name, webViewLink'
    });
    res.json({ success: true, file: file.data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ELIMINAR ARCHIVO
app.delete('/api/archivos/:id', async (req, res) => {
  try {
    await drive.files.delete({ fileId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'No se pudo eliminar' });
  }
});

// BLOQUEAR ARCHIVO
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

// DESBLOQUEAR MANUALMENTE
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

// REEMPLAZAR ARCHIVO
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
