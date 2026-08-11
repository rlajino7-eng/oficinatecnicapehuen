const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ---------------------------------------------------------
// 1. CONFIGURACIÓN GOOGLE DRIVE API (OAUTH2)
// ---------------------------------------------------------
const FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// ---------------------------------------------------------
// 2. BASE DE DATOS DE USUARIOS Y CONTRASEÑAS
// ---------------------------------------------------------
let usuariosAutorizados = [
  { id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' },
  { id: 2, email: 'ingeniero1@pehuen.cl', password: 'pehuen123', rol: 'ingeniero', nombre: 'Ingeniero Montaje' }
];

// ---------------------------------------------------------
// 3. ENDPOINT DE INICIO DE SESIÓN (LOGIN)
// ---------------------------------------------------------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const usuario = usuariosAutorizados.find(u => u.email === email && u.password === password);

  if (usuario) {
    res.json({ success: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } else {
    res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos' });
  }
});

// ---------------------------------------------------------
// 4. ENDPOINTS PARA ADMINISTRAR USUARIOS
// ---------------------------------------------------------
app.get('/api/usuarios', (req, res) => {
  res.json(usuariosAutorizados);
});

app.post('/api/usuarios', (req, res) => {
  const { nombre, email, rol, password } = req.body;
  const nuevoUsuario = { 
    id: Date.now(), 
    nombre, 
    email, 
    password: password || 'pehuen123', 
    rol: rol || 'ingeniero' 
  };
  usuariosAutorizados.push(nuevoUsuario);
  res.json({ success: true, usuarios: usuariosAutorizados });
});

app.delete('/api/usuarios/:id', (req, res) => {
  usuariosAutorizados = usuariosAutorizados.filter(u => u.id != req.params.id);
  res.json({ success: true, usuarios: usuariosAutorizados });
});

// ---------------------------------------------------------
// 5. ENDPOINTS GOOGLE DRIVE (LISTAR Y SUBIR ARCHIVOS)
// ---------------------------------------------------------
app.get('/api/archivos', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, createdTime)',
      orderBy: 'createdTime desc'
    });
    res.json(response.data.files);
  } catch (error) {
    console.error('Error listando archivos:', error);
    res.status(500).json({ error: 'Error conectando a Google Drive Pehuén' });
  }
});

app.post('/api/subir', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún archivo.' });
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID]
    };
    const media = {
      mimeType: req.file.mimetype,
      body: bufferStream
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink'
    });

    res.json({ success: true, file: file.data });
  } catch (error) {
    console.error('Error al subir a Drive:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al subir documento al servidor Drive' 
    });
  }
});

// ESTA LÍNEA ES LA QUE FALTABA PARA ABRIR EL PUERTO EN RENDER:
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Oficina Técnica Pehuén activa y escuchando en el puerto ${PORT}`);
});
