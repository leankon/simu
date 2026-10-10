// pagina con el aparato de 6 botones. hace lo mismo que el hardware real:
// el aparato arma la trama que mandaria por el HC-12, y el "puente" la lee
// y le hace el POST al back. las dos cosas se ven en la terminal de abajo
import { armarTrama, leerTrama } from './protocolo.js'

// la direccion del back. se puede cambiar desde la pantalla (queda guardada)
const API_POR_DEFECTO = 'https://soli-olive.vercel.app'

// los 6 botones del aparato. "tipo" es lo que se guarda en la base y tiene que
// coincidir con TEXTO_MOTIVO del front (Llamados.tsx), si no se ve el texto crudo.
// prioridad no manda nada: deja armado el proximo boton para que vaya con prioridad
const BOTONES = [
  { tipo: 'mozo', texto: 'Mozo' },
  { tipo: 'cuenta', texto: 'Cuenta' },
  { tipo: 'pan', texto: 'Pan' },
  { tipo: 'menu', texto: 'Menu' },
  { tipo: 'cancelar', texto: 'Cancelar' },
  { tipo: 'prioridad', texto: 'Prioridad' },
]

// cuanto tiempo queda armada la prioridad despues de apretarla
const VENTANA_PRIORIDAD_MS = 5000

// el aparato real no deberia mandar 10 llamados si el cliente aprieta muchas
// veces seguidas. mientras dura esto, el boton no hace nada
const ESPERA_ENTRE_APRIETES_MS = 1500

const inputApi = document.getElementById('api')
const selectMesa = document.getElementById('mesa')
const led = document.getElementById('led')
const pantallita = document.getElementById('pantallita')
const contenedorBotones = document.getElementById('botones')
const registro = document.getElementById('registro')

let ocupado = false

// el aparato solo sabe el numero de su mesa; el back quiere el id
let idPorNumero = new Map()

// hasta cuando vale la prioridad. 0 es "no esta armada"
let prioridadHasta = 0
let relojPrioridad = null

function prioridadArmada() {
  return Date.now() < prioridadHasta
}

function desarmarPrioridad() {
  prioridadHasta = 0
  clearInterval(relojPrioridad)
  contenedorBotones.lastElementChild.classList.remove('armado')
}

function armarPrioridad() {
  if (!selectMesa.value) {
    anotar('No hay mesa elegida', false)
    prenderLed('rojo')
    return
  }
  prioridadHasta = Date.now() + VENTANA_PRIORIDAD_MS
  contenedorBotones.lastElementChild.classList.add('armado')
  prenderLed('azul')

  // la pantallita cuenta para atras como lo haria el aparato
  const mostrar = () => {
    const quedan = Math.ceil((prioridadHasta - Date.now()) / 1000)
    if (quedan <= 0) {
      desarmarPrioridad()
      mostrarMesa()
      return
    }
    pantallita.textContent = 'PRIORIDAD ' + quedan + 's'
  }
  clearInterval(relojPrioridad)
  mostrar()
  relojPrioridad = setInterval(mostrar, 200)
}

function leerGuardado(clave, siNoHay) {
  try {
    return localStorage.getItem(clave) || siNoHay
  } catch {
    return siNoHay
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // sin localStorage igual funciona, solo no se acuerda
  }
}

function api() {
  return inputApi.value.trim().replace(/\/+$/, '')
}

function prenderLed(color) {
  led.className = 'led led-' + color
}

// clase: 'radio' (lo que sale del HC-12), 'ok' o 'error'
function anotar(texto, clase) {
  const li = document.createElement('li')
  li.className = clase === true ? 'ok' : clase === false ? 'error' : clase
  li.textContent = new Date().toLocaleTimeString() + '  ' + texto
  registro.append(li)
  registro.scrollTop = registro.scrollHeight
}

async function cargarMesas() {
  selectMesa.innerHTML = '<option value="">Cargando...</option>'
  try {
    const r = await fetch(api() + '/mesas')
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const mesas = await r.json()

    selectMesa.innerHTML = ''
    if (mesas.length === 0) {
      selectMesa.innerHTML = '<option value="">No hay mesas</option>'
      return
    }
    // el aparato se configura con el numero de mesa, como el real
    idPorNumero = new Map(mesas.map((m) => [Number(m.numero), m.id]))
    for (const m of mesas) {
      const op = document.createElement('option')
      op.value = m.numero
      op.textContent = 'Mesa ' + m.numero
      selectMesa.append(op)
    }
    const anterior = leerGuardado('soli-mesa', '')
    if (mesas.some((m) => String(m.numero) === anterior)) selectMesa.value = anterior
    mostrarMesa()
  } catch (err) {
    selectMesa.innerHTML = '<option value="">Error al cargar</option>'
    anotar('No pude traer las mesas: ' + err.message, false)
    prenderLed('rojo')
  }
}

function mostrarMesa() {
  const op = selectMesa.selectedOptions[0]
  pantallita.textContent = selectMesa.value ? op.textContent : 'Elegi una mesa'
  prenderLed('apagado')
}

async function apretar(boton, elemento) {
  if (ocupado) return
  if (boton.tipo === 'prioridad') return armarPrioridad()

  const numeroMesa = Number(selectMesa.value)
  if (!numeroMesa) {
    anotar('No hay mesa elegida', false)
    prenderLed('rojo')
    return
  }

  // la prioridad se gasta con este boton, salga bien o mal
  const conPrioridad = prioridadArmada()
  desarmarPrioridad()
  const etiqueta = boton.texto + (conPrioridad ? ' (PRIORIDAD)' : '')

  ocupado = true
  elemento.classList.add('apretado')
  prenderLed('amarillo')
  pantallita.textContent = 'Enviando ' + etiqueta + '...'

  // 1) el aparato transmite por el HC-12
  const trama = armarTrama(numeroMesa, boton.tipo, conPrioridad)
  anotar('HC-12 >> ' + trama.trim(), 'radio')

  try {
    // 2) el puente recibe la trama, la valida y la pasa al back
    const { tipo, prioridad } = leerTrama(trama)
    const idMesa = idPorNumero.get(numeroMesa)
    if (idMesa === undefined) throw new Error('la mesa ' + numeroMesa + ' no existe en el back')

    const cuerpo = { tipo, id_mesa: idMesa, prioridad }
    anotar('puente >> POST /solicitudes ' + JSON.stringify(cuerpo), 'radio')
    const r = await fetch(api() + '/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const datos = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(datos.error || 'HTTP ' + r.status)

    prenderLed('verde')
    pantallita.textContent = etiqueta + ' enviado'
    anotar('back   << ' + r.status + ' solicitud ' + datos.id, true)
  } catch (err) {
    prenderLed('rojo')
    pantallita.textContent = 'Error'
    anotar('ERROR ' + err.message, false)
  }

  setTimeout(() => {
    ocupado = false
    elemento.classList.remove('apretado')
  }, ESPERA_ENTRE_APRIETES_MS)
}

// armo los botones a partir de la lista de arriba
BOTONES.forEach((boton, i) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'boton-aparato'
  b.innerHTML = '<span class="tecla">' + (i + 1) + '</span>' + boton.texto
  b.addEventListener('click', () => apretar(boton, b))
  contenedorBotones.append(b)
})

// teclas 1 a 6, como si fueran los botones fisicos
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return
  const i = Number(e.key) - 1
  if (i >= 0 && i < BOTONES.length) contenedorBotones.children[i].click()
})

inputApi.value = leerGuardado('soli-api', API_POR_DEFECTO)
inputApi.addEventListener('change', () => {
  guardar('soli-api', api())
  cargarMesas()
})
selectMesa.addEventListener('change', () => {
  guardar('soli-mesa', selectMesa.value)
  mostrarMesa()
})
document.getElementById('recargar').addEventListener('click', cargarMesas)

cargarMesas()
