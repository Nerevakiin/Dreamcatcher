import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import helmet from 'helmet';
import { initDatabase } from './config/database-init.js';
import dreamsRouter from './routes/dreams.js';
import pool from './config/database.js';
import { uptime } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();

/*
Challenge: 
  1. Write code so the 'helmet' middleware below only runs in a 'production' environment.
*/

// app.use(helmet());

const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));


// health endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      status: 'ok',
      db: 'connected',
      uptime: process.uptime()
    })
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      message: err.message,
      uptime: process.uptime()
    })
  }
})


// API Routes
app.use('/api/dreams', dreamsRouter);


// shutdown endpoint: delete after testing
app.get('/shutdown', (req, res) => {
  console.log('=== MANUAL SHUTDOWN TRIGGERED ===');
  res.send('Shutting down...');
  
  setTimeout(() => {
    process.kill(process.pid, 'SIGTERM');
  }, 100);
});




// Initialize database then start server

let server

initDatabase().then(() => {
  server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  // Error Exit Code 1
  process.exit(1)
});


// Learning about graceful shutdown

process.on('SIGTERM', gracefulShutdown)

async function gracefulShutdown() {
  console.log('SIGTERM received, shutting down gracefully!')
  
  // Close the server first (stop accepting new connections)
  server.close(() => {
    console.log('HTTP Server closed!')
  })

  // Then close database pool
  try {
    await pool.end()
    console.log('Database pool closed')
    process.exit(0)
  } catch (err) {
    console.error('Error closing database pool: ', error)
    process.exit(1)
  }
}
