# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

SPA web responsive; no es una app móvil.

## Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + MapLibre GL + deck.gl, servida en `https://navby.andeva.tech/app`. Fuente de verdad: `docs/navby-webapp-documentation.md` y `AGENTS.md`.

## Users

Viajeros independientes hispanohablantes (y globales) de 20 a 55 años que compran sus propios pasajes: viajeros de ocio pragmáticos, nómadas digitales, familias y freelancers. Llegan cansados de comparar decenas de pestañas.

## Product Purpose

El usuario elige dos ciudades, fechas y pasajeros; ve la ruta en un mapa 2D y recibe un podio de 3 vuelos ordenados por un puntaje que combina precio, duración y escalas, con enlace directo de compra. Cada búsqueda cuesta 5 créditos (10 gratis al día).

## Surface Mode

Operate: herramienta de búsqueda y comparación. Las pantallas de acceso pueden ser algo más expresivas, nunca de marketing.

## Brand Commitments

- Paleta, Albert Sans, isologo Raptor V3 y reglas visuales en `DESIGN.md`.
- Voz: confiable, práctica y cercana; frases cortas; tuteo.
- Palabras prohibidas en la interfaz: nodos, vértices, aristas, grafo, OpenFlights, FlightAPI, BFS, A-Star, Dijkstra.

## Product Principles

1. Recomendar, no listar: tres respuestas, no un muro de opciones.
2. Precio honesto: toda tarifa lleva el aviso de precio referencial (RL-03).
3. Respetar el tiempo: la búsqueda vive en la URL y la acción principal está a un clic.
4. Claridad sobre jerga.

## Accessibility & Inclusion

WCAG 2.1 AA, foco visible, `prefers-reduced-motion`, lista textual equivalente al mapa, español e inglés.
