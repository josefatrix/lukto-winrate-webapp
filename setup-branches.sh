#!/bin/bash
set -e

echo "🔧 Configurando ramas Git..."

cd /Users/joseescorcia/Documents/lukto-winrate-webapp

echo "📦 Guardando cambios pendientes..."
git add -A
git commit -m "feat: add deploy workflow scripts and guide" || echo "Nada nuevo que commitear"

echo "🏷️ Creando tag v1.5.0..."
git tag -a v1.5.0 -m "Versión estable - producción actual" 2>/dev/null || echo "Tag ya existe"

echo "🌿 Creando rama develop..."
git checkout -b develop 2>/dev/null || git checkout develop

echo "☁️ Subiendo a GitHub..."
git push origin main develop --tags

echo "✅ ¡Listo! Estructura configurada:"
echo "   main (v1.5.0) ← Producción"
echo "   develop ← Desarrollo"

