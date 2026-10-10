// lee "--nombre valor" de la linea de comandos
export function argumento(nombre, siNoHay) {
  const i = process.argv.indexOf('--' + nombre)
  return i === -1 ? siNoHay : process.argv[i + 1]
}

// el HC-12 viene de fabrica a 9600 baudios
export const BAUDIOS_HC12 = 9600

// abre un puerto serie real. serialport se carga solo si se usa,
// asi el simulador funciona sin instalar nada
export async function abrirPuerto(ruta) {
  let SerialPort
  try {
    ;({ SerialPort } = await import('serialport'))
  } catch {
    console.error('Para usar un puerto serie real hay que instalar serialport: npm install')
    process.exit(1)
  }
  const puerto = new SerialPort({ path: ruta, baudRate: BAUDIOS_HC12 })
  // sin esto, un puerto mal escrito o desenchufado tira un error ilegible
  puerto.on('error', (err) => {
    console.error('Error con el puerto ' + ruta + ': ' + err.message)
    process.exit(1)
  })
  return puerto
}
