# IA opcional para catalogos PDF

El generador funciona siempre con el analisis visual basico incluido. Florence-2 y
la eliminacion de fondo se cargan de forma diferida y nunca bloquean la descarga
si el servidor no tiene recursos suficientes.

## Instalacion

Desde `backend`:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements-ai.txt
```

Configuracion:

```env
CATALOG_AI_ENABLED=true
CATALOG_AI_MODEL=microsoft/Florence-2-base
CATALOG_AI_ALLOW_DOWNLOAD=true
```

La primera ejecucion puede descargar el modelo. En produccion se recomienda
precargarlo durante la construccion de la imagen y luego establecer
`CATALOG_AI_ALLOW_DOWNLOAD=false`.

## Comportamiento seguro

- El nombre del modelo se configura en el servidor, no llega desde el cliente.
- Los resultados de analisis y fondos removidos se almacenan en
  `uploads/catalog-ai-cache` para evitar reprocesar cada descarga.
- Si Florence-2 o rembg fallan, se usa el analisis local con Pillow y se conserva
  la imagen original.
- La remocion de fondo solo se aplica cuando el administrador la activa global o
  individualmente para un producto.
