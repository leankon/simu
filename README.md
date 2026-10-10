# Simulador de hardware SOLI (HC-12)

## Pagina web (el simulador)

`index.html` es el aparato de una mesa con sus 6 botones. Cada boton arma la
misma trama que mandaria el HC-12, el puente la lee y hace el POST al back.
Todo eso se ve en la terminal de la pagina.

Se sube a Vercel tal cual (Import del repo, framework "Other", sin build).
Para probar en la compu: `npx serve .` y abrir la direccion que muestra
(abrir el `index.html` con doble click no anda, porque usa modulos).

## Programas de terminal (para el hardware real)

```
[aparato de la mesa]  --radio HC-12-->  [HC-12 receptor por USB]  -->  puente.js  --HTTP-->  back
   6 botones                               en la compu del local                 POST /solicitudes
```

- `aparato.js` simula el aparato de una mesa: 6 botones y un HC-12 que transmite tramas por serie.
- `puente.js` es el programa de la compu del local: lee las tramas del HC-12 receptor y las pasa
  al back (`https://soli-olive.vercel.app`). Sirve igual con el simulador y con el hardware real.
- `protocolo.js` define la trama. El firmware del Arduino tiene que mandar exactamente esto.

## La trama

Una linea de texto por cada boton, a 9600 baudios (lo que trae el HC-12 de fabrica):

```
<numeroMesa>,<tipo>,<prioridad>*<checksum>\n
3,mozo,1*15
```

| campo      | valores                                         |
|------------|-------------------------------------------------|
| numeroMesa | el numero pegado en la mesa (no el id de la base) |
| tipo       | `mozo`, `cuenta`, `pan`, `menu`, `cancelar`     |
| prioridad  | `1` si antes se apreto Prioridad, `0` si no     |
| checksum   | XOR de todos los bytes antes del `*`, en hexa con 2 digitos |

El puente descarta las tramas con checksum mal (ruido de radio) y convierte el numero de mesa en el
`id` de la base con `GET /mesas`. Despues manda:

```
POST /solicitudes
{ "tipo": "mozo", "id_mesa": 9, "prioridad": true }
```

> Hoy el back ignora `prioridad` hasta que agreguen la columna.

## Botones

| tecla | boton     |
|-------|-----------|
| 1     | Mozo      |
| 2     | Cuenta    |
| 3     | Pan       |
| 4     | Menu      |
| 5     | Cancelar  |
| 6     | Prioridad |

Prioridad no transmite nada: si en los 5 segundos siguientes se aprieta otro boton, esa trama va con
prioridad `1`. Ademas el aparato ignora apretes a menos de 1,5 s del anterior.
En el simulador, `m` cambia de mesa y `q` sale.

## Uso

Necesita Node 18 o mas nuevo.

**Sin hardware** (el pipe hace de radio):

```
node aparato.js --mesa 3 | node puente.js
```

**Con el HC-12 receptor real** enchufado por USB:

```
npm install
node puente.js --puerto COM3            # Windows
node puente.js --puerto /dev/ttyUSB0    # Linux
```

**Probar la radio sin el Arduino**: con un segundo HC-12 por USB, el simulador transmite por el aire:

```
node aparato.js --mesa 3 --puerto COM4
```

Para apuntar a un back local: `--api http://localhost:3000` en `puente.js`.

## Tests

```
npm test
```
