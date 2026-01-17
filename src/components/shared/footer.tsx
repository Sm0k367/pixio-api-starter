// src/components/shared/footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="py-8 mt-auto bg-gradient-to-t from-primary/5 via-transparent to-transparent backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand Section */}
          <div>
            <Link href="/" className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent">
              Epic<span className="font-bold">Tech</span>AI
            </Link>
            <p className="text-muted-foreground mt-2 text-sm">
              Advanced AI Generation SaaS Platform
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <Link href="/pricing" className="hover:text-primary transition block">
                Pricing
              </Link>
              <Link href="/login" className="hover:text-primary transition block">
                Login
              </Link>
              <Link href="/signup" className="hover:text-primary transition block">
                Sign up
              </Link>
              <Link href="#" className="hover:text-primary transition block">
                Documentation
              </Link>
            </div>
          </div>

          {/* Contact & Social */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Connect With Us</h3>
            <div className="space-y-2 text-sm">
              <a href="mailto:epictechai@gmail.com" className="hover:text-primary transition block">
                📧 epictechai@gmail.com
              </a>
              <a href="https://x.com/EpicTechAI" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition block">
                🐦 @EpicTechAI
              </a>
              <a href="https://github.com/epictechai" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition block">
                💻 GitHub
              </a>
              <a href="https://buy.stripe.com/dR6dRZ5yc5yPaVq9AE" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition block">
                💳 Get Started
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-primary/10">
          <p className="text-xs text-center text-muted-foreground">
            © {new Date().getFullYear()} Epic Tech AI. All rights reserved. | Built with ❤️ for creators and developers
          </p>
        </div>
      </div>
    </footer>
  );
}
