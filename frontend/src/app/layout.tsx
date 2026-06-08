import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: "Simulateur de défibrillateur - Formation Médicale | Hôpital Saint-Louis",
  description: "Plateforme de formation aux techniques de défibrillation développée pour l'Hôpital Saint-Louis. Scénarios réalistes, ECG authentiques et apprentissage sécurisé pour les professionnels de santé.",
  keywords: [
    "défibrillateur", 
    "simulation médicale", 
    "formation médicale", 
    "urgences cardiaques", 
    "DAE", 
    "cardioversion", 
    "fibrillation ventriculaire",
    "arrêt cardiaque",
    "ECG",
    "formation soignants",
    "Hôpital Saint-Louis"
  ],
  authors: [
    { name: "Marius GAL", url: "https://www.linkedin.com/in/marius-gal/" }, 
    { name: "Dr. Sami Ellouze", url: "https://www.linkedin.com/in/sami-ellouze-23791330/" }, 
    { name: "Marc Dinh", url: "https://www.linkedin.com/in/marc-dinh/" }
  ],
  creator: "Marius GAL",
  publisher: "Hôpital Saint-Louis",
  category: "Medical Education",
  
  // Open Graph (Facebook, LinkedIn, Discord, WhatsApp, etc.)
  openGraph: {
    title: "Simulateur de défibrillateur - Formation Médicale",
    description: "Plateforme de formation aux techniques de défibrillation développée pour l'Hôpital Saint-Louis. Scénarios réalistes et apprentissage sécurisé.",
    url: "https://defib-simulation.vercel.app", 
    siteName: "Simulateur de défibrillateur",
    images: [
      {
        url: "/images/og-image.png", 
        width: 1200,
        height: 630,
        alt: "Interface du simulateur de défibrillateur - Formation médicale"
      }
    ],
    locale: "fr_FR",
    type: "website"
  },
  
  // Twitter Cards
  twitter: {
    card: "summary_large_image",
    title: "Simulateur de défibrillateur",
    description: "Formation aux techniques de défibrillation - Hôpital Saint-Louis",
    images: ["/images/og-image.png"],
    creator: "@defib_simulation",
  },
  
  // Métadonnées supplémentaires
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Métadonnées pour les appareils mobiles
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  
  // Données structurées pour le SEO
  other: {
    "application-name": "Simulateur de défibrillateur",
    "msapplication-TileColor": "#1f2937",
    "theme-color": "#1f2937",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Simulateur Défibrillateur"
  },
  
  // Métadonnées pour les performances
  alternates: {
    canonical: "https://defib-simulation.vercel.app"
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Données structurées Schema.org pour le contenu médical/éducatif
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalApplication",
    "name": "Simulateur de défibrillateur",
    "description": "Plateforme de formation aux techniques de défibrillation développée pour l'Hôpital Saint-Louis",
    "url": "https://defib-simulation.vercel.app",
    "applicationCategory": "MedicalApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock"
    },
    "provider": {
      "@type": "Organization",
      "name": "Hôpital Saint-Louis",
      "url": "https://hopital-saintlouis.aphp.fr/",
      "sameAs": [
        "https://hopital-saintlouis.aphp.fr/"
      ]
    },
    "author": [
      {
        "@type": "Person",
        "name": "Marius GAL",
        "jobTitle": "Engineering student",
        "url": "https://www.linkedin.com/in/marius-gal/"
      },
      {
        "@type": "Person",
        "name": "Dr. Sami Ellouze",
        "jobTitle": "Médecin Urgentiste",
        "url": "https://www.linkedin.com/in/sami-ellouze-23791330/"
      },
      {
        "@type": "Person",
        "name": "Marc Dinh",
        "jobTitle": "ML/Deep Learning Engineer",
        "url": "https://www.linkedin.com/in/marc-dinh/"
      }
    ],
    "educationalLevel": "Professional",
    "educationalUse": "Medical Training",
    "learningResourceType": "Simulation",
    "teaches": [
      "Défibrillation",
      "Reconnaissance ECG",
      "Gestion des urgences cardiaques",
      "Utilisation DAE"
    ],
    "audience": {
      "@type": "Audience",
      "audienceType": "Healthcare professionals"
    },
    "license": "https://opensource.org/licenses/MIT"
  };

  return (
    <html lang="fr">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"
        />
        {/* Preconnect pour optimiser les performances */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Données structurées Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData)
          }}
        />
        
        {/* Preload des ressources critiques */}
        <link rel="preload" href="/images/og-image.png" as="image" />
        <link rel="preload" href="/images/badge.png" as="image" />
        
        {/* DNS prefetch pour les domaines externes */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
        
      
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Simulateur Défibrillateur" />
        <link rel="apple-touch-icon" href="/web-app-manifest-192x192.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}