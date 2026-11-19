# Crear una marca o un kit desde GitHub

**Propuesta pendiente de implementación.** Una persona con GitHub vinculado elige un repositorio, una rama y, en un monorepo, la carpeta de la aplicación. La web le muestra lo que ha detectado y le deja revisar el resultado. La primera entrega cubre repositorios públicos y funciona bajo demanda en los servicios actuales.

## Esfuerzo y orden de entrega

Estimación para una persona familiarizada con el proyecto, incluidas las pruebas de cada entrega.

| Entrega | Dificultad | Tiempo estimado | Resultado |
| --- | --- | --- | --- |
| Selector y lectura común | Media | 1–2 días | Elegir un repo público de la cuenta, rama y carpeta. |
| Marca desde repo | Baja–media tras el selector | 1–2 días | Revisar los tokens y el logo detectados y guardar un perfil privado. |
| Kit desde repo | Media–alta tras el selector | 3–5 días | Revisar un manifiesto y descargar el kit con los archivos elegidos. |
| Repositorios privados | Media–alta | 3–5 días adicionales | Autorizar únicamente los repositorios elegidos mediante una GitHub App. |

El MVP público suma **5–9 días de desarrollo**. El factor de incertidumbre principal es la paridad entre el detector del CLI y el lector remoto, especialmente con workspaces y árboles grandes.

## Fase 1 · Seleccionar y leer un repositorio público

1. [ ] Extraer el lector de token de `apps/web/src/server/publish.ts` a un módulo de servidor compartido. Mantener el login de Better Auth y sus permisos actuales de identidad. Una cuenta creada con Google puede vincular GitHub desde su cuenta.
2. [ ] Añadir «From GitHub» a los creadores de kits y marcas. Al elegirlo, listar los repositorios públicos de la cuenta con `GET /user/repos`. Paginar, mostrar propietario y nombre y permitir buscar entre los repositorios accesibles. [API de repositorios](https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user)
3. [ ] Preseleccionar la rama predeterminada del repositorio, ofrecer las demás ramas y dejar elegir una carpeta en monorepos. Resolver la rama a un SHA cuando el usuario confirme la selección.
4. [ ] Implementar un lector compartido para listar rutas y leer archivos regulares a ese SHA. Limitar archivos, bytes, concurrencia y tiempo por importación. Si el árbol está truncado, acotar el análisis a la carpeta elegida e indicar cualquier resultado parcial. [Árboles Git](https://docs.github.com/en/rest/git/trees#get-a-tree) · [Contenido del repositorio](https://docs.github.com/en/rest/repos/contents#get-repository-content)
5. [ ] Validar sesión y acceso en cada operación del servidor. Omitir secretos, enlaces simbólicos y submódulos. Mostrar cómo recuperarse de un repositorio vacío, una rama desaparecida, el límite de la API o una autorización revocada.

**Criterio de cierre.** Probar una cuenta con dos páginas de repositorios, un proyecto con la rama predeterminada distinta de `main` y un monorepo. Ambas entradas deben leer los mismos archivos del mismo commit aunque se actualice la rama durante la revisión.

## Fase 2 · Crear una marca desde GitHub

Depende de la fase 1. Puede entregarse antes que el importador de kits.

1. [ ] Buscar en la carpeta seleccionada un perfil explícito, tokens JSON, hojas de estilo globales, logo y favicon. Dar prioridad al perfil explícito y registrar la ruta de origen de cada valor.
2. [ ] Pasar los archivos por los detectores de `packages/schema/src/brand-detect.ts`. Para varios logos o paletas, mostrar los candidatos en la revisión de `BrandCreator`. Ante una detección vacía, ofrecer el editor manual.
3. [ ] Dejar cambiar nombres, colores, fuentes, imágenes y reglas en el borrador. Validar el contenido y tamaño de las imágenes y guardar los bytes elegidos para que el perfil sea portable.
4. [ ] Elegir cuenta u organización, verificar permisos y guardar con el mismo flujo de creación privada. Abrir la copia en Mis marcas y mostrar el comando del CLI.

**Criterio de cierre.** Importar un proyecto CSS y un monorepo con dos paletas, cambiar el logo y aplicar el perfil guardado desde el CLI. Cancelar la revisión debe dejar intacta la lista de marcas.

## Fase 3 · Crear un kit desde GitHub

Depende de la fase 1. Comparte el lector con las marcas.

1. [ ] Separar en `packages/cli/src/create/` la lectura del disco, la inferencia y las preguntas interactivas. Mantener un adaptador local para el CLI y añadir uno para los archivos del lector de GitHub.
2. [ ] Detectar framework, gestor, dependencias, skills, MCP e instrucciones. Mostrar qué se encontró en cada archivo y permitir corregir la selección. Empezar con los archivos adicionales desmarcados y excluir credenciales literales de las configuraciones MCP.
3. [ ] Construir el manifiesto con `buildKitJson`, validarlo con `loadKitFrom` y su política de admisión, y presentar el resultado de `buildPlan`. Los errores de validación deben llevar al campo que se puede corregir.
4. [ ] Entregar un archivo descargable con `kit.json` y los archivos elegidos. Para publicar, el creador incorpora el kit al repositorio y usa el publicador actual, que comprueba el permiso de escritura y la versión en un commit fijo. La creación automática de un PR quedaría para una entrega con permiso de escritura propio.

**Criterio de cierre.** Comparar el mismo proyecto importado por CLI y web. Descomprimir el kit en una carpeta limpia, instalarlo y ejecutar su verificación. Cubrir monorepo, framework desconocido y manifiesto inválido. Descargar el kit debe dejar la decisión de publicarlo al creador.

## Fase 4 · Extender ambos flujos a repositorios privados

1. [ ] Al elegir un repositorio privado, conectar una GitHub App con lectura de metadatos y contenido. Permitir que el propietario seleccione las instalaciones y repositorios autorizados. [Permisos e instalaciones de GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)
2. [ ] Listar y leer únicamente la intersección entre permisos del usuario y repositorios de la instalación. Gestionar aprobación pendiente de la organización, credenciales caducadas y revocación durante una importación.
3. [ ] Aplicar las reglas de visibilidad existentes al guardar. Una marca pertenece a su cuenta u organización. La publicación de un kit de origen privado requiere la visibilidad de organización que admite el publicador. Conservar archivos durante la revisión solo durante el tiempo necesario.
4. [ ] Probar ambos flujos con dos miembros de acceso distinto y una instalación revocada. Verificar que los tokens y archivos privados quedan fuera de logs, índices, catálogo público, sitemap y respuestas de otras cuentas.

**Criterio de cierre.** Cada miembro ve solo sus repositorios autorizados. Revocar acceso entre selección y lectura detiene la importación. Una marca ya guardada conserva su logo tras caducar la credencial y un kit privado sigue sujeto a las comprobaciones de lectura en la web y el CLI.
