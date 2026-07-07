import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://defib-simulation.vercel.app'
  const lastModified = new Date('2026-01-01')

  return [
    { url: baseUrl, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${baseUrl}/connect`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/#features`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/#scenarios`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/#contributors`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ]
}