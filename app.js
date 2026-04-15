import express from 'express';
import routes from './src/routes/index.js';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';
import path from 'path';

dotenv.config();

const PORT = process.env.PORT || 5001;
const ENV = process.env.ENV || 'development';
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configura Express para servir archivos estáticos desde la carpeta 'uploads'
// Esto hace que cualquier archivo en 'uploads' sea accesible mediante URL:
// http://localhost:5001/losrones/uploads/...
const __dirname = path.resolve();
app.use('/losrones/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/losrones', routes);

// Ejemplo de endpoint de prueba
app.get('/losrones/test', (req, res) => {
  res.send('OK');
});

if (ENV === 'production') {
  // Configuración HTTPS: usa los certificados de Let's Encrypt
  const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/biozonos.com.co/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/biozonos.com.co/fullchain.pem')
  };

  https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`Secure server is online at https://biozonos.com.co:${PORT}/losrones`);
  });
} else {
  // Modo desarrollo (HTTP)
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is online at http://localhost:${PORT}/losrones`);
  });
}
