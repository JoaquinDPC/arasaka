import {
  House,
  Car,
  HeartPulse,
  Utensils,
  User,
  Gift,
  PawPrint,
  Plane,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  TrendingUp,
  PiggyBank,
  Wallet,
  Undo2,
  GraduationCap,
  Smartphone,
  Shirt,
  Coffee,
  Scissors,
  Dumbbell,
  Tag,
  Star,
  Hexagon,
  Diamond,
  Leaf,
  Moon,
  Bookmark,
  Flag,
  Zap,
  Anchor,
  Compass,
  Feather,
  Music,
  Camera,
  Bell,
  Box,
  Award,
  Triangle,
  Cloud,
  Sun,
} from 'lucide-react'
import { hashString } from './constants'

// Keyword → icon name. normalize() is applied before lookup.
// Keys cover Spanish and English variants; word-level matching handles compound tags.
const KEYWORD_ICONS = {
  // Housing / home
  House:         ['casa', 'home', 'house', 'hogar', 'depto', 'departamento', 'apartamento',
                  'arriendo', 'alquiler', 'hipoteca', 'rent', 'condominio', 'expensas',
                  'hotel', 'airbnb', 'hospedaje', 'alojamiento'],

  // Transport / fuel
  Car:           ['auto', 'coche', 'car', 'vehiculo', 'transporte', 'nafta', 'combustible',
                  'peaje', 'toll', 'taxi', 'uber', 'cabify', 'bencina', 'gasolina',
                  'estacionamiento', 'parking', 'colectivo', 'bus'],

  // Health
  HeartPulse:    ['salud', 'health', 'medico', 'doctor', 'farmacia', 'pharmacy', 'hospital',
                  'clinica', 'obrasocial', 'dentista', 'dentist', 'medicina', 'consulta'],

  // Food / dining
  Utensils:      ['comida', 'food', 'restaurante', 'restaurant', 'almuerzo', 'lunch',
                  'cena', 'dinner', 'desayuno', 'breakfast', 'supermercado', 'supermarket',
                  'super', 'delivery', 'feria', 'mercado', 'market', 'cocina', 'kitchen'],

  // Social / people
  User:          ['personal', 'amigos', 'friends', 'familia', 'family', 'sociales', 'social'],

  // Gifts / bonuses
  Gift:          ['regalo', 'gift', 'presente', 'bono', 'bonus', 'gratificacion', 'premio', 'award'],

  // Pets
  PawPrint:      ['mascota', 'pet', 'perro', 'dog', 'gato', 'cat', 'veterinario', 'vet',
                  'veterinaria', 'animales', 'animals'],

  // Travel / flights
  Plane:         ['vacaciones', 'vacation', 'viaje', 'travel', 'trip', 'holiday',
                  'vuelo', 'flight', 'avion', 'airplane', 'turismo', 'tourism'],

  // Insurance
  ShieldCheck:   ['seguro', 'seguros', 'insurance', 'cobertura', 'poliza'],

  // Subscriptions / transfers
  RefreshCw:     ['suscripcion', 'subscription', 'suscripciones', 'subscriptions',
                  'transferencia', 'transfer', 'envio', 'recurrente', 'mensual'],

  // Leisure / fun
  Sparkles:      ['gustos', 'ocio', 'leisure', 'entretenimiento', 'entertainment',
                  'fun', 'hobby', 'lujo', 'luxury', 'capricho'],

  // Investments / income from capital
  TrendingUp:    ['inversion', 'invest', 'inversiones', 'investments',
                  'dividendos', 'dividends', 'acciones', 'stocks', 'fondos', 'funds',
                  'bolsa', 'renta', 'retorno'],

  // Savings / wealth
  PiggyBank:     ['patrimonio', 'wealth', 'ahorro', 'savings', 'fondo', 'reserva', 'reserve'],

  // Income / salary
  Wallet:        ['sueldo', 'salary', 'salario', 'ingreso', 'income', 'freelance',
                  'pago', 'remuneracion', 'honorario', 'cobro', 'liquidacion'],

  // Refunds
  Undo2:         ['devolucion', 'refund', 'reembolso', 'reintegro', 'cashback'],

  // Education
  GraduationCap: ['educacion', 'education', 'school', 'colegio', 'estudio', 'study',
                  'curso', 'course', 'universidad', 'university', 'capacitacion', 'training'],

  // Tech / phone / digital services
  Smartphone:    ['tecnologia', 'tech', 'internet', 'telefono', 'phone', 'celular',
                  'mobile', 'digital'],

  // Clothing / shoes
  Shirt:         ['ropa', 'clothes', 'clothing', 'vestimenta', 'calzado', 'shoes',
                  'zapatos', 'indumentaria', 'moda', 'fashion'],

  // Coffee / bar
  Coffee:        ['cafe', 'coffee', 'bar', 'cafeteria', 'cantina', 'pub'],

  // Beauty / hair
  Scissors:      ['belleza', 'beauty', 'peluqueria', 'hairdresser', 'estetica',
                  'spa', 'manicura', 'depilacion', 'barberia'],

  // Fitness
  Dumbbell:      ['gym', 'gimnasio', 'fitness', 'deporte', 'sport', 'ejercicio',
                  'exercise', 'entrenamiento', 'training'],

  // Music / concerts / streaming audio
  Music:         ['spotify', 'concierto', 'concert', 'musica', 'music',
                  'recital', 'show', 'festival'],

  // Video / cinema / streaming video
  Camera:        ['cine', 'cinema', 'movie', 'pelicula', 'film', 'netflix',
                  'youtube', 'video', 'streaming', 'foto', 'photo'],

  // Cloud services
  Cloud:         ['icloud', 'cloud', 'nube', 'dropbox', 'drive', 'backup'],

  // Packages / e-commerce
  Box:           ['amazon', 'paquete', 'package', 'ecommerce', 'compra', 'shopping',
                  'mercadolibre', 'mercadopago', 'tienda', 'store'],

  // Utilities / electricity
  Zap:           ['luz', 'light', 'electricity', 'electricidad', 'energia',
                  'energy', 'enel', 'chilectra'],

  // Optics / eyecare
  Sun:           ['optica', 'optics', 'lentes', 'glasses', 'vision', 'ojos', 'eyes'],

  // Misc / default
  Tag:           ['otros', 'other', 'misc', 'varios', 'miscelaneo', 'general'],
}

export const ICON_BY_NAME = {
  House, Car, HeartPulse, Utensils, User, Gift, PawPrint, Plane,
  ShieldCheck, RefreshCw, Sparkles, TrendingUp, PiggyBank, Wallet,
  Undo2, GraduationCap, Smartphone, Shirt, Coffee, Scissors, Dumbbell,
  Music, Camera, Cloud, Box, Zap, Sun, Tag,
  Star, Hexagon, Diamond, Leaf, Moon, Bookmark, Flag,
  Anchor, Compass, Feather, Bell, Award, Triangle,
}

// Generic icons used as deterministic hash fallback for unknown tags.
const HASH_ICON_POOL = [
  Star, Hexagon, Diamond, Leaf, Moon, Bookmark, Flag,
  Anchor, Compass, Feather, Bell, Award, Triangle,
]

const KEYWORD_TO_ICON = (() => {
  const m = new Map()
  for (const [iconName, kws] of Object.entries(KEYWORD_ICONS)) {
    for (const k of kws) m.set(k, iconName)
  }
  return m
})()

function normalize(s) {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
// overrideIcon: if provided, resolves directly from ICON_BY_NAME without keyword lookup.
export function getCatIcon(cat, overrideIcon) {
  if (overrideIcon && ICON_BY_NAME[overrideIcon]) return ICON_BY_NAME[overrideIcon]

  const key = normalize(cat)
  if (!key) return Tag

  // 1. Exact match
  const exact = KEYWORD_TO_ICON.get(key)
  if (exact) return ICON_BY_NAME[exact]

  // 2. Word-level match — handles compound tags like "comida-mascota" → matches "mascota"
  const words = key.split(/[-_\s]+/).filter(Boolean)
  for (const word of words) {
    const wordMatch = KEYWORD_TO_ICON.get(word)
    if (wordMatch) return ICON_BY_NAME[wordMatch]
  }

  // 3. Deterministic hash fallback for truly unknown tags
  const idx = hashString(key) % HASH_ICON_POOL.length
  return HASH_ICON_POOL[idx]
}
