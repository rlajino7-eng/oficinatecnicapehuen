const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');
const path = require('path');
const app = express();

app.use(express.json());
// Sirve los archivos desde la raíz principal (como lo configuramos)
app.use(express.static(__dirname));

// ---------------------------------------------------------
// 1. CONFIGURACIÓN GOOGLE DRIVE API
// ---------------------------------------------------------
const FOLDER_ID = process.env.DRIVE_FOLDER_ID || 'TU_ID_DE_CARPETA_AQUI';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
  scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });
const upload = multer();

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
    res.status(500).json({ error: 'Error conectando a Google Drive Pehuén' });
  }
});

app.post('/api/subir', upload.single('archivo'), async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Error al subir documento al servidor Drive' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Oficina Técnica Pehuén activa en puerto ${PORT}`));
