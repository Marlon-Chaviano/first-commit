<!-- Borra la sección que no aplique. Guía completa: CONTRIBUTING.md -->

## Qué cambia

<!-- Biblioteca nueva, kit nuevo, corrección… -->

## Biblioteca del catálogo (`registry/libraries.json`)

- [ ] El paquete existe y la versión que se instala es estable (enlace a npm, PyPI o pkg.go.dev):
- [ ] El skill, si lo hay, es oficial (de la organización de la biblioteca) y aparece en skills.sh:
- [ ] `kind` y `frameworks` correctos; `usage` explica al agente cómo usarla en una o dos frases.
- [ ] Los archivos (`writeFiles`) compilan sin claves: nada de clientes que fallen al importar sin variables de entorno.
- [ ] Las tareas manuales (`setupTasks`) dicen qué hacer y dónde.
- [ ] Añadida a `verify.matrix` de al menos un kit que la ofrece.

## Kit oficial (`registry/kits/*`)

- [ ] He subido `version` del kit.
- [ ] `verify.matrix` cubre las opciones nuevas.

## Pruebas

- [ ] `pnpm registry:check` pasa.
- [ ] `pnpm test` pasa.
- [ ] `create-first-commit test <kit>` pasa para las combinaciones afectadas (pega el resumen):

```
```
