import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, TrendingDown, Timer, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-black tracking-tighter"
              style={{ fontFamily: 'Chivo, sans-serif' }}
            >
              BidFlow
            </motion.div>
            <div className="flex gap-4">
              <Button
                data-testid="login-button"
                onClick={() => navigate('/login')}
                variant="ghost"
                className="rounded-full"
              >
                Login
              </Button>
              <Button
                data-testid="register-button"
                onClick={() => navigate('/register')}
                className="rounded-full px-8 bg-[#0047FF] hover:bg-[#0047FF]/90 text-white shadow-lg shadow-[#0047FF]/20"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            <h1 
              className="text-5xl md:text-7xl font-black tracking-tighter leading-none"
              style={{ fontFamily: 'Chivo, sans-serif' }}
            >
              Real-Time Auctions,
              <br />
              <span className="text-[#0047FF]">Your Way</span>
            </h1>
            <p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Experience lightning-fast bidding with both forward and reverse auctions.
              Auto-bidding, real-time updates, and instant notifications.
            </p>
            <Button
              data-testid="hero-get-started-button"
              onClick={() => navigate('/register')}
              className="rounded-full px-10 py-6 text-lg font-bold bg-[#0A0A0A] hover:bg-[#0A0A0A]/90 text-white"
            >
              Start Bidding Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-white p-8 transition-all hover:border-[#0047FF]/50 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#0047FF]/10">
                  <TrendingUp className="h-6 w-6 text-[#0047FF]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    Forward Auctions
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Sell to the highest bidder. Perfect for collectibles, art, and high-value items.
                    Watch the price rise in real-time.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-white p-8 transition-all hover:border-[#0047FF]/50 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#10B981]/10">
                  <TrendingDown className="h-6 w-6 text-[#10B981]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    Reverse Auctions
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Buy at the lowest price. Ideal for procurement and finding the best deals.
                    Suppliers compete to win your business.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-white p-8 transition-all hover:border-[#0047FF]/50 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#F59E0B]/10">
                  <Zap className="h-6 w-6 text-[#F59E0B]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    Auto-Bidding
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Set your maximum price and let the system bid for you automatically.
                    Never miss out while staying within budget.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-white p-8 transition-all hover:border-[#0047FF]/50 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#EF4444]/10">
                  <Timer className="h-6 w-6 text-[#EF4444]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    Real-Time Updates
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    See bids as they happen with WebSocket technology. Live countdowns and
                    instant notifications keep you in the action.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2026 BidFlow. Real-time auction platform.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
