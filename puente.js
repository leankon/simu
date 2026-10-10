// el programa que corre en la compu del local, con el HC-12 receptor enchufado
// por USB. lee las tramas que mandan los aparatos y las pasa al back.
//
//   node puente.js --puerto COM3            (Windows, HC-12 real)
//   node puente.js --puerto /dev/ttyUSB0    (Linux)
//   node aparato.js --mesa 3 | node puente.js   (sin hardware: lee de stdin)
//
// opcional: --api http://localhost:3000 (por defecto la de vercel)

import readline from 'node:readline'
import { leerTrama } from './protocolo.js'
import { argumento, abrirPuerto } from './util.js'

const API = argumento('api', 'https://soli-olive.vercel.app').replace(/\/+$/, '')
const puerto = argumento('puerto')

// el aparato conoce el numero de su mesa, el back quiere el id.
// guardo la tabla numero -> id y la vuelvo a pedir si llega un numero que no conozco
let idPorNumero = new Map()

function hora() {
  return new Date().toLocaleTimeString()
}

async function cargarMesas() {
  const r = await fetch(API + '/mesas')
  if (!r.ok) throw new Error('GET /mesas devolvio ' + r.status)
  const mesas = await r.json()
  idPorNumero = new Map(mesas.map((m) => [Number(m.numero), m.id]))
}

async function idDeMesa(numero) {
  if (!idPorNumero.has(numero)) await cargarMesas()
  return idPorNumero.get(numero)
}

async function procesar(linea) {
  if (linea.trim() === '') return

  let trama
  try {
    trama = leerTrama(linea)
  } catch (err) {
    // ruido de radio o trama cortada: se descarta, no se manda nada al back
    console.error(hora() + ' descartada "' + linea.trim() + '": ' + err.message)
    return
  }

  const { numeroMesa, tipo, prioridad } = trama
  const etiqueta = 'mesa ' + numeroMesa + ' ' + tipo + (prioridad ? ' (PRIORIDAD)' : '')

  try {
    const idMesa = await idDeMesa(numeroMesa)
    if (idMesa === undefined) throw new Error('la mesa ' + numeroMesa + ' no existe en el back')

    const r = await fetch(API + '/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id_mesa: idMesa, prioridad }),
    })
    const datos = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(datos.error || 'HTTP ' + r.status)

    console.error(hora() + ' OK ' + etiqueta + ' -> solicitud ' + datos.id)
  } catch (err) {
    console.error(hora() + ' ERROR ' + etiqueta + ': ' + err.message)
  }
}

const entrada = puerto ? await abrirPuerto(puerto) : process.stdin
console.error('Puente SOLI: escuchando ' + (puerto || 'stdin') + ', mandando a ' + API)

// las tramas se procesan de a una, en el orden en que llegaron
let cola = Promise.resolve()
readline.createInterface({ input: entrada }).on('line', (linea) => {
  cola = cola.then(() => procesar(linea))
})
