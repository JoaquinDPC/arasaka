# Backlog — cosas para revisar después

## Performance

### `ListUsedTags` — evaluar desnormalizar frecuencias
`backend/internal/repository/transaction_repo.go:178`

Query actual hace index scan sobre todas las transactions del usuario y hace `unnest(tags) + GROUP BY + count`. Para escala personal (<2000 rows) está bien (~2ms). Si la app crece en usuarios, considerar agregar columna `use_count INT DEFAULT 0` en `user_tags` e incrementarla al guardar tags.

**Complejidad del cambio:**
- Incrementar al guardar ✓
- Decrementar al quitar tags (edge case)
- Recalcular en bulk import / migrations de normalización
- Riesgo de drift si no se mantiene consistente

**Trigger real para hacerlo:** múltiples usuarios o endpoint lento en profiling.
