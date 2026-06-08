import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-8">
          <Image
            src="/images/badge.png"
            alt="Logo"
            width={120}
            height={120}
            className="mx-auto mb-6"
          />
        </div>
        
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-300 mb-4">
          Page non trouvée
        </h2>
        <p className="text-gray-400 mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        
        <div className="space-y-4">
          <Link href="/">
            <button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all duration-300">
              Retour à l'accueil
            </button>
          </Link>
          
          <Link href="/simulator">
            <button className="w-full mt-3 bg-gray-800 text-gray-300 py-3 px-6 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-300">
              Accéder au simulateur
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
} 