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

function anotar(texto, ok) {
  const li = document.createElement('li')
  li.className = ok ? 'ok' : 'error'
  li.textContent = new Date().toLocaleTimeString() + ' — ' + texto
  registro.prepend(li)
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
    // se manda el id de la base, pero el que se ve es el numero de la mesa
    for (const m of mesas) {
      const op = document.createElement('option')
      op.value = m.id
      op.textContent = 'Mesa ' + m.numero + ' (id ' + m.id + ')'
      selectMesa.append(op)
    }
    const anterior = leerGuardado('soli-mesa', '')
    if (mesas.some((m) => String(m.id) === anterior)) selectMesa.value = anterior
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

  const idMesa = Number(selectMesa.value)
  if (!idMesa) {
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

  try {
    const r = await fetch(api() + '/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: boton.tipo, id_mesa: idMesa, prioridad: conPrioridad }),
    })
    const datos = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(datos.error || 'HTTP ' + r.status)

    prenderLed('verde')
    pantallita.textContent = etiqueta + ' enviado'
    anotar(etiqueta + ' → mesa id ' + idMesa + ' (solicitud ' + datos.id + ')', true)
  } catch (err) {
    prenderLed('rojo')
    pantallita.textContent = 'Error'
    anotar(etiqueta + ' → mesa id ' + idMesa + ' fallo: ' + err.message, false)
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
