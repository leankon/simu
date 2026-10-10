import test from 'node:test'
import assert from 'node:assert/strict'
import { armarTrama, leerTrama } from './protocolo.js'

test('ida y vuelta', () => {
  const trama = armarTrama(3, 'mozo', true)
  assert.match(trama, /^3,mozo,1\*[0-9A-F]{2}\n$/)
  assert.deepEqual(leerTrama(trama), { numeroMesa: 3, tipo: 'mozo', prioridad: true })
})

test('sin prioridad', () => {
  assert.equal(leerTrama(armarTrama(12, 'cuenta', false)).prioridad, false)
})

test('descarta tramas rotas', () => {
  const buena = armarTrama(3, 'pan', false).trim()
  assert.throws(() => leerTrama(buena.replace('pan', 'pam')), /checksum/)
  assert.throws(() => leerTrama('3,pan,0'), /sin checksum/)
  assert.throws(() => leerTrama(buena.slice(0, 4)), /checksum/)
})
