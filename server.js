// Funciones para leer y guardar usuarios directamente en Google Drive
async function obtenerUsuariosDrive() {
  try {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name = 'usuarios.json' and trashed = false`,
      fields: 'files(id)'
    });
    if (res.data.files.length > 0) {
      const fileId = res.data.files[0].id;
      const fileContent = await drive.files.get({ fileId: fileId, alt: 'media' });
      return fileContent.data;
    } else {
      // Si no existe el archivo aún, creamos uno con los administradores por defecto
      const defaultUsers = [
        { id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' },
        { id: 2, email: 'ingeniero1@pehuen.cl', password: 'pehuen123', rol: 'ingeniero', nombre: 'Ingeniero Montaje' }
      ];
      await guardarUsuariosDrive(defaultUsers);
      return defaultUsers;
    }
  } catch (err) {
    return [
      { id: 1, email: 'admin@pehuen.cl', password: 'Pehuen2026*', rol: 'admin', nombre: 'Admin Técnico' },
      { id: 2, email: 'ingeniero1@pehuen.cl', password: 'pehuen123', rol: 'ingeniero', nombre: 'Ingeniero Montaje' }
    ];
  }
}

async function guardarUsuariosDrive(usuarios) {
  try {
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name = 'usuarios.json' and trashed = false`,
      fields: 'files(id)'
    });
    
    const bufferStream = new stream.PassThrough();
    bufferStream.end(JSON.stringify(usuarios, null, 2));

    if (res.data.files.length > 0) {
      await drive.files.update({
        fileId: res.data.files[0].id,
        media: { mimeType: 'application/json', body: bufferStream }
      });
    } else {
      await drive.files.create({
        resource: { name: 'usuarios.json', parents: [FOLDER_ID] },
        media: { mimeType: 'application/json', body: bufferStream }
      });
    }
  } catch (err) {
    console.error('Error guardando usuarios en Drive', err);
  }
}

// Rutas de autenticación y gestión conectadas a Google Drive
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const usuarios = await obtenerUsuariosDrive();
  const usuario = usuarios.find(u => u.email === email && u.password === password);
  if (usuario) {
    res.json({ success: true, usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } else {
    res.status(401).json({ success: false, error: 'Correo o contraseña incorrectos' });
  }
});

app.get('/api/usuarios', async (req, res) => {
  const usuarios = await obtenerUsuariosDrive();
  res.json(usuarios);
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre, email, rol, password } = req.body;
  let usuarios = await obtenerUsuariosDrive();
  usuarios.push({ id: Date.now(), nombre, email, password: password || 'pehuen123', rol: rol || 'ingeniero' });
  await guardarUsuariosDrive(usuarios);
  res.json({ success: true, usuarios });
});

app.delete('/api/usuarios/:id', async (req, res) => {
  let usuarios = await obtenerUsuariosDrive();
  usuarios = usuarios.filter(u => u.id != req.params.id);
  await guardarUsuariosDrive(usuarios);
  res.json({ success: true, usuarios });
});
