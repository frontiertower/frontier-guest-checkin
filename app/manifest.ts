import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Frontier Tower Check-In',
    short_name: 'FT Check-In',
    description: 'Guest check-in station for Frontier Tower',
    start_url: '/checkin',
    display: 'standalone',
    orientation: 'landscape',
    background_color: '#0f0f12',
    theme_color: '#6B46C1',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    related_applications: []
  }
}