const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const stream = require('stream');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const FOLDER_ID = process.env.DRIVE_FOLDER_ID || '';
const oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });
const upload = multer({ storage: multer.memoryStorage() });

// --- ENDPOINT: ELIMINAR ---
app.delete('/api/archivos/:id', async (req, res) => {
  try {
    await drive.files.delete({ fileId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo eliminar el archivo' });
  }
});

// --- ENDPOINT: REEMPLAZAR (Actualizar contenido) ---
app.put('/api/archivos/:id', upload.single('archivo'), async (req, res) => {
  try {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);
    const file = await drive.files.update({
      fileId: req.params.id,
      media: { mimeType: req.file.mimetype, body: bufferStream }
    });
    res.json({ success: true, file: file.data });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo reemplazar el archivo' });
  }
});

// --- ENDPOINT: LISTAR CON CATEGORÍAS (Basado en nombre del archivo) ---
app.get('/api/archivos', async (req, res) => {
  const response = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and trashed = false`,
    fields: 'files(id, name, webViewLink, webContentLink)',
  });
  // Lógica simple: Categoría según prefijo del nombre (ej: "PLANO_nombre.pdf")
  const archivos = response.data.files.map(f => ({
    ...f,
    categoria: f.name.includes('_') ? f.name.split('_')[0] : 'GENERAL'
  }));
  res.json(archivos);
});

// (Mantén aquí el resto de tus endpoints de login/usuarios...)
app.listen(process.env.PORT || 3000);
