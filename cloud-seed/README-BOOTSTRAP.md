# Cómo arrancar el repositorio `imagina-crm-cloud`

Pasos para crear el repo nuevo con todo el contexto transferido. Los pasos
1-3 los hacés vos (yo no puedo crear repos fuera de `imagina-crm` desde las
sesiones de este repo); del 4 en adelante lo hace Claude Code en el repo
nuevo.

## 1. Crear el repositorio en GitHub

`augusto97/imagina-crm-cloud` (privado). Sin README inicial.

## 2. Sembrar el repo (local, ~5 minutos)

```bash
git clone git@github.com:augusto97/imagina-crm.git
git clone git@github.com:augusto97/imagina-crm-cloud.git
cd imagina-crm-cloud

# Documentos de contexto (el "cerebro" transferido):
cp ../imagina-crm/cloud-seed/CLAUDE.md    ./CLAUDE.md
cp ../imagina-crm/cloud-seed/STANDALONE.md ./STANDALONE.md
cp ../imagina-crm/cloud-seed/HANDOFF.md   ./HANDOFF.md

# El frontend heredado (se adaptará en F1, pero viaja desde el día 0):
mkdir -p apps/web
cp -r ../imagina-crm/app        apps/web/app
cp ../imagina-crm/package.json  apps/web/
cp ../imagina-crm/tsconfig.json apps/web/
cp ../imagina-crm/vite.config.ts apps/web/
cp ../imagina-crm/tailwind.config.ts apps/web/

git add -A
git commit -m "chore: seed inicial — docs de arquitectura + frontend heredado del plugin"
git push -u origin main
```

## 3. Configurar Claude Code para el repo nuevo

En claude.ai/code: crear un environment apuntando a
`augusto97/imagina-crm-cloud` (misma config de red que usás para el plugin).

## 4. Primera sesión en el repo nuevo

Primer mensaje sugerido:

> Lee CLAUDE.md, STANDALONE.md y HANDOFF.md completos. Después arranca la
> fase F0 del roadmap: monorepo pnpm+Turborepo, esqueleto NestJS+Drizzle,
> Docker Compose (Postgres 16 + Redis 7), tenancy con RLS funcionando y el
> package shared/ con los primeros schemas Zod. Marca F0 en el CLAUDE.md
> cuando termines.

Con esos tres documentos, cualquier sesión nueva tiene: la arquitectura
completa con sus porqués (STANDALONE), las reglas de trabajo (CLAUDE) y los
errores ya pagados que no debe repetir (HANDOFF).

## 5. Mantener el puente con el plugin

- El plugin sigue desarrollándose en `imagina-crm` con su CLAUDE.md.
- Mejoras de frontend hechas en un repo que valgan para el otro se portan a
  mano (ADR-S08: fork, no paquete compartido — re-evaluar más adelante).
- Este directorio `cloud-seed/` puede borrarse del repo del plugin una vez
  sembrado el repo nuevo (o dejarse como registro).
