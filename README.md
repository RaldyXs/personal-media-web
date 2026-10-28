# Personal Media Hub (Web Client)

> Cliente web ligero, desacoplado y de alto rendimiento para streaming multimedia personal, construido bajo principios **SOLID** y arquitectura modular sin dependencias externas.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Architecture: Clean/SOLID](https://img.shields.io/badge/Architecture-SOLID-success.svg)](#principios-solid-aplicados)
[![Platform: Web / Mobile](https://img.shields.io/badge/Platform-Mobile%20%7C%20Web-lightgrey.svg)](#compatibilidad-móvil-e-ios)

---

## 🏛️ Arquitectura del Sistema

El proyecto implementa un desacoplamiento estricto entre la **Capa de Presentación e Interacción (Frontend)** y el **Motor de Almacenamiento y Streaming (Backend / Servidor Linux)**:

```
┌────────────────────────────────────────────────────────┐
│               FRONTEND (GitHub / Pages)                │
│                                                        │
│   AppBootstrap (Composition Root & Dependency Injection)│
│        │                               │               │
│        ▼                               ▼               │
│   PlayerController              CatalogController      │
│        │                               │               │
│        ▼                               ▼               │
│   IStorageProvider              MediaRepository        │
│        │                               │               │
│        └───────────────┬───────────────┘               │
│                        ▼                               │
│                 StreamConnector                        │
└────────────────────────┬───────────────────────────────┘
                         │
                         │ HTTP / HTTPS (Range Requests)
                         ▼
┌────────────────────────────────────────────────────────┐
│               BACKEND (Servidor Linux)                 │
│                                                        │
│   • Nginx Edge: Slicing (512k chunks) & Range Filter   │
│   • Video Engine: H.264 (yuv420p) + AAC + faststart    │
│   • Storage Node: Almacenamiento local ilimitado       │
└────────────────────────────────────────────────────────┘
```

---

## 💎 Principios SOLID Aplicados

| Principio | Implementación en este proyecto | Beneficio |
| :--- | :--- | :--- |
| **S** - *Single Responsibility* | Cada clase tiene un único motivo para cambiar: `PlayerController` gobierna el elemento de video, `StorageService` gestiona la persistencia, `MediaRepository` mapea y normaliza datos, y `StreamConnector` resuelve endpoints de red. | Mantenimiento predecible, pruebas unitarias aisladas y legibilidad inmediata. |
| **O** - *Open/Closed* | Los contratos de almacenamiento (`IStorageProvider`) y repositorio (`IMediaRepository`) admiten extensiones (ej. migrar de `localStorage` a `IndexedDB` o Nginx a Jellyfin) sin modificar la UI ni el reproductor. | Abierto a nuevas fuentes, cerrado a regresiones. |
| **L** - *Liskov Substitution* | Cualquier implementación que herede de `IStorageProvider` o `IMediaRepository` puede sustituir a la actual sin que el cliente note ninguna diferencia en tiempo de ejecución. | Polimorfismo confiable y tipado consistente. |
| **I** - *Interface Segregation* | Contratos divididos en interfaces compactas y coherentes (`IStorageProvider`, `IMediaRepository`, `MediaItem`). Los consumidores solo dependen de lo que usan. | No hay métodos "muertos" ni dependencias forzadas. |
| **D** - *Dependency Inversion* | Los controladores de alto nivel (`PlayerController`, `CatalogController`) no instancian directamente el almacenamiento o la red; reciben abstracciones inyectadas por `AppBootstrap`. | Desacoplamiento total de la infraestructura concreta. |

---

## 📁 Estructura del Proyecto

```
personal-media-web/
├── index.html                   # Documento HTML5 semántico y accesible
├── styles/
│   ├── variables.css            # Design tokens, escalas tipográficas y paleta Zinc
│   ├── layout.css               # Grilla fluida y comportamiento responsive móvil
│   └── components.css           # Estilos atómicos: reproductor, barra de estado y catálogo
├── src/
│   ├── config/
│   │   └── app.config.js        # Configuración centralizada de ejecución y timeouts
│   ├── contracts/
│   │   ├── IStorage.js          # Contrato abstracto de persistencia
│   │   └── IMediaSource.js      # Contrato y modelo de entidad MediaItem
│   ├── services/
│   │   ├── StorageService.js    # Implementación sobre Web Storage API (SRP)
│   │   ├── StreamConnector.js   # Resolución dinámica de topología de red
│   │   └── MediaRepository.js   # Ingesta, parseo y normalización de catálogo
│   ├── controllers/
│   │   ├── PlayerController.js  # Orquestador del ciclo de vida del video HTML5
│   │   └── CatalogController.js # Estado visual, filtrado en tiempo real y selección
│   └── app.js                   # Composition Root / Inyector de dependencias
├── .gitignore                   # Exclusiones estándar
├── LICENSE                      # Licencia MIT
└── README.md                    # Documentación de ingeniería
```

---

## ⚡ Conectividad Dinámica del Backend

La aplicación detecta el servidor de medios de forma flexible mediante tres estrategias de resolución ordenada:

1. **Parámetro URL (`?backend=https://...`):**  
   Permite compartir un enlace directo a la librería indicando qué túnel o IP debe consultar:
   ```
   https://tu-usuario.github.io/stream-web/?backend=https://tu-tunel.trycloudflare.com
   ```
2. **Memoria Local (`localStorage`):**  
   Si se define una vez, queda persistido en el navegador del cliente.
3. **Mismo Origen (Relative Paths):**  
   Si se despliega dentro de la misma máquina o Nginx, las rutas se resuelven como `/videos/` de forma nativa.

---

## 📱 Compatibilidad Móvil e iOS

Para garantizar reproducción fluida en **iPhone (iOS Safari / Brave)** y **Android**:
* **Contenedor:** MP4 con atom `moov` al inicio (`faststart`).
* **Códecs:** H.264 perfil `yuv420p` + Audio AAC estéreo.
* **Fotogramas Clave (GOP):** `-g 48 -keyint_min 24`, asegurando un I-Frame cada 2 segundos para saltos inmediatos sin congelamiento.
* **Precarga:** `preload="auto"` para almacenamiento continuo en memoria temporal.
* **Streaming:** Soporte completo de cabeceras de rango `HTTP 206 Partial Content`.

---

## 🚀 Despliegue

### Despliegue en GitHub Pages:
1. Sube este repositorio a tu cuenta de GitHub.
2. Dirígete a **Settings** -> **Pages**.
3. En **Branch**, selecciona `main` y la carpeta `/(root)`.
4. En segundos tu aplicación estará activa en `https://tu-usuario.github.io/nombre-repo/`.

### Despliegue en Cloudflare Pages:
1. En el panel de Cloudflare, selecciona **Workers & Pages** -> **Create application** -> **Pages** -> **Connect GitHub**.
2. Selecciona este repositorio y dale a **Deploy**.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia [MIT](LICENSE).
