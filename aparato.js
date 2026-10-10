// simula el aparato de una mesa: 6 botones y un HC-12 que transmite.
// lo que "sale por la radio" (las tramas) va a stdout, o a un puerto serie
// real con --puerto. todo lo que es pantalla va a stderr, asi se puede hacer:
//
//   node aparato.js --mesa 3 | node puente.js
//
// teclas: 1 Mozo, 2 Cuenta, 3 Pan, 4 Menu, 5 Cancelar, 6 Prioridad
//         m cambiar de mesa, q salir

import readline from 'node:readline'
import { armarTrama } from './protocolo.js'
import { argumento, abrirPuerto } from './util.js'

const BOTONES = {
  1: { tipo: 'mozo', texto: 'Mozo' },
  2: { tipo: 'cuenta', texto: 'Cuenta' },
  3: { tipo: 'pan', texto: 'Pan' },
  4: { tipo: 'menu', texto: 'Menu' },
  5: { tipo: 'cancelar', texto: 'Cancelar' },
  6: { tipo: 'prioridad', texto: 'Prioridad' },
}

// despues de apretar prioridad, el proximo boton dentro de este tiempo va con prioridad
const VENTANA_PRIORIDAD_MS = 5000
// el firmware ignora apretes muy seguidos para no mandar 10 llamados iguales
const ESPERA_ENTRE_APRIETES_MS = 1500

let numeroMesa = Number(argumento('mesa', '1'))
let prioridadHasta = 0
let bloqueadoHasta = 0

const puertoSalida = argumento('puerto')
const radio = puertoSalida ? await abrirPuerto(puertoSalida) : process.stdout

function mostrar(texto) {
  process.stderr.write('[mesa ' + numeroMesa + '] ' + texto + '\n')
}

function transmitir(tipo, prioridad) {
  const trama = armarTrama(numeroMesa, tipo, prioridad)
  radio.write(trama)
  mostrar('HC-12 >> ' + trama.trim())
}

function apretar(tecla) {
  const boton = BOTONES[tecla]
  if (!boton) return

  if (boton.tipo === 'prioridad') {
    prioridadHasta = Date.now() + VENTANA_PRIORIDAD_MS
    mostrar('PRIORIDAD armada por ' + VENTANA_PRIORIDAD_MS / 1000 + 's')
    return
  }

  if (Date.now() < bloqueadoHasta) {
    mostrar(boton.texto + ' ignorado (muy seguido)')
    return
  }
  bloqueadoHasta = Date.now() + ESPERA_ENTRE_APRIETES_MS

  // la prioridad se gasta con este boton
  const conPrioridad = Date.now() < prioridadHasta
  prioridadHasta = 0
  transmitir(boton.tipo, conPrioridad)
}

function preguntarMesa() {
  process.stdin.setRawMode(false)
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  rl.question('Numero de mesa: ', (r) => {
    rl.close()
    const n = Number(r)
    if (Number.isInteger(n) && n > 0) numeroMesa = n
    else mostrar('numero invalido, sigo con la misma')
    escucharTeclas()
  })
}

function alApretar(_, tecla) {
  if (tecla.ctrl && tecla.name === 'c') salir()
  if (tecla.name === 'q') salir()
  if (tecla.name === 'm') {
    process.stdin.off('keypress', alApretar)
    return preguntarMesa()
  }
  apretar(tecla.sequence)
}

function escucharTeclas() {
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('keypress', alApretar)
}

function salir() {
  if (radio.close) radio.close()
  process.exit(0)
}

if (!process.stdin.isTTY) {
  process.stderr.write('aparato.js necesita una terminal para leer las teclas\n')
  process.exit(1)
}

readline.emitKeypressEvents(process.stdin)
process.stderr.write(
  'Aparato SOLI (HC-12)\n' +
    '  1 Mozo  2 Cuenta  3 Pan  4 Menu  5 Cancelar  6 Prioridad\n' +
    '  m cambiar mesa   q salir\n',
)
mostrar(puertoSalida ? 'transmitiendo por ' + puertoSalida : 'transmitiendo por stdout')
escucharTeclas()
