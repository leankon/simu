// lo que viaja por el aire entre el aparato de la mesa y el HC-12 receptor.
// el HC-12 es transparente: lo que entra por serie de un lado sale por serie
// del otro, sin garantia de que llegue sano. por eso cada trama es una linea
// de texto con un checksum al final:
//
//   <numeroMesa>,<tipo>,<prioridad>*<checksum>\n
//   3,mozo,1*15
//
// numeroMesa: el numero que tiene pegado la mesa (no el id de la base)
// tipo:       mozo | cuenta | pan | menu | cancelar
// prioridad:  1 si antes se apreto prioridad, 0 si no
// checksum:   XOR de todos los bytes antes del *, en hexa con 2 digitos
//             (igual que NMEA, facil de calcular en el Arduino)

export const TIPOS = ['mozo', 'cuenta', 'pan', 'menu', 'cancelar']

export function checksum(texto) {
  let x = 0
  for (const c of Buffer.from(texto, 'ascii')) x ^= c
  return x.toString(16).toUpperCase().padStart(2, '0')
}

export function armarTrama(numeroMesa, tipo, prioridad) {
  const cuerpo = numeroMesa + ',' + tipo + ',' + (prioridad ? 1 : 0)
  return cuerpo + '*' + checksum(cuerpo) + '\n'
}

// devuelve { numeroMesa, tipo, prioridad } o tira un error que dice que esta mal
export function leerTrama(linea) {
  const limpia = linea.trim()
  const [cuerpo, chk] = limpia.split('*')
  if (chk === undefined) throw new Error('sin checksum')
  if (checksum(cuerpo) !== chk.toUpperCase()) throw new Error('checksum incorrecto')

  const partes = cuerpo.split(',')
  if (partes.length !== 3) throw new Error('cantidad de campos incorrecta')
  const [mesa, tipo, prio] = partes

  const numeroMesa = Number(mesa)
  if (!Number.isInteger(numeroMesa) || numeroMesa <= 0) throw new Error('mesa invalida')
  if (!TIPOS.includes(tipo)) throw new Error('tipo desconocido: ' + tipo)
  if (prio !== '0' && prio !== '1') throw new Error('prioridad invalida')

  return { numeroMesa, tipo, prioridad: prio === '1' }
}
