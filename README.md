# Simulador de hardware SOLI

Simula el aparato de 6 botones que va en cada mesa. Cada boton le avisa al
back (`https://soli-olive.vercel.app`) igual que lo haria el hardware:

```
POST /solicitudes
Content-Type: application/json

{ "tipo": "mozo", "id_mesa": 3 }
```

La solicitud queda `pendiente` y aparece en la Vista Mozo y en el Panel Encargado.

## Como usarlo

Abrir `index.html` en el navegador (no necesita instalar nada), o servirlo:

```
npx serve .
```

1. Elegir la mesa (se cargan de `GET /mesas`; se manda el `id`, no el numero).
2. Apretar un boton (o las teclas 1 a 6).
3. El led se pone verde si el back respondio bien y rojo si fallo.

## Botones

Estan en la lista `BOTONES` al principio de `simulador.js`. El `tipo` tiene que
coincidir con `TEXTO_MOTIVO` del front (`Front-end/src/components/Llamados.tsx`).
