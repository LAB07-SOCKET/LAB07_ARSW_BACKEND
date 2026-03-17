import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

// Almacenamiento en memoria 
const db = {
  juan: [
    { author: 'juan', name: 'plano-1', points: [{ x: 10, y: 10 }, { x: 40, y: 50 }] },
    { author: 'juan', name: 'plano-2', points: [{ x: 100, y: 80 }] },
  ],
  admin: [
    { author: 'admin', name: 'edificio', points: [{ x: 20, y: 30 }, { x: 60, y: 90 }] },
  ],
}

function getAuthorBlueprints(author) {
  return db[author] ?? []
}

// REST CRUD 
app.get('/api/blueprints', (req, res) => {
  const { author } = req.query
  if (!author) return res.status(400).json({ error: 'author requerido' })
  const list = getAuthorBlueprints(author)
  const total = list.reduce((sum, bp) => sum + bp.points.length, 0)
  res.json({ author, blueprints: list, totalPoints: total })
})

// GET /api/blueprints/:author/:name, para los puntos del plano
app.get('/api/blueprints/:author/:name', (req, res) => {
  const { author, name } = req.params
  const bp = getAuthorBlueprints(author).find(b => b.name === name)
  if (!bp) return res.status(404).json({ error: 'No encontrado' })
  res.json(bp)
})

// POST /api/blueprints,  crea un nuevo plano
app.post('/api/blueprints', (req, res) => {
  const { author, name, points = [] } = req.body
  if (!author || !name) return res.status(400).json({ error: 'author y name requeridos' })
  if (!db[author]) db[author] = []
  if (db[author].find(b => b.name === name))
    return res.status(409).json({ error: 'Ya existe' })
  const bp = { author, name, points }
  db[author].push(bp)
  res.status(201).json(bp)
})

// PUT /api/blueprints/:author/:name, actualiza los puntos
app.put('/api/blueprints/:author/:name', (req, res) => {
  const { author, name } = req.params
  const list = getAuthorBlueprints(author)
  const idx = list.findIndex(b => b.name === name)
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' })
  list[idx].points = req.body.points ?? list[idx].points
  res.json(list[idx])
})

// DELETE /api/blueprints/:author/:name,  elimina los puntos del plano
app.delete('/api/blueprints/:author/:name', (req, res) => {
  const { author, name } = req.params
  if (!db[author]) return res.status(404).json({ error: 'No encontrado' })
  const before = db[author].length
  db[author] = db[author].filter(b => b.name !== name)
  if (db[author].length === before)
    return res.status(404).json({ error: 'No encontrado' })
  res.status(204).end()
})

// Socket.IO 
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', (socket) => {
  socket.on('join-room', (room) => {
    if (!room || typeof room !== 'string') {
      console.warn('join-room ignorado: room inválido', room)
      return
  }
  socket.join(room)
  console.log(`join-room: ${room}`)
})
  socket.on('draw-event', ({ room, point, author, name }) => {
  if (!room || !author || !name) {
    console.warn('draw-event ignorado: faltan campos obligatorios')
    return
  }
  if (typeof point?.x !== 'number' || typeof point?.y !== 'number') {
    console.warn('draw-event ignorado: punto inválido', point)
    return
  }
  const list = getAuthorBlueprints(author)
  const bp = list.find(b => b.name === name)
  if (bp) bp.points.push(point)
  socket.to(room).emit('blueprint-update', { author, name, points: [point]})
})
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`Socket.IO up on :${PORT}`))