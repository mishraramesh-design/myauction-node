import { motion } from 'framer-motion';
import { Clock, TrendingUp, TrendingDown, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export const AuctionCard = ({ auction, onClick, isOwner = false, userBid = null }) => {
  const isActive = auction.status === 'active' && new Date(auction.end_time) > new Date();
  const timeLeft = isActive ? formatDistanceToNow(new Date(auction.end_time), { addSuffix: true }) : 'Ended';

  return (
    <motion.div
      data-testid={`auction-card-${auction.id}`}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-border bg-white transition-all hover:border-[#0047FF]/50 hover:shadow-lg cursor-pointer"
    >
      {/* Image */}
      <div className="aspect-video w-full overflow-hidden bg-secondary">
        {auction.image_url ? (
          <img
            src={auction.image_url}
            alt={auction.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-secondary to-secondary/50">
            <div className="text-6xl font-black text-muted-foreground/20">
              {auction.title.charAt(0)}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-bold leading-tight line-clamp-1" style={{ fontFamily: 'Chivo, sans-serif' }}>
              {auction.title}
            </h3>
            <Badge 
              variant={auction.auction_type === 'forward' ? 'default' : 'secondary'}
              className="text-xs shrink-0 ml-2"
            >
              {auction.auction_type === 'forward' ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {auction.description}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Price</p>
            <p 
              className="text-2xl font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              ${auction.current_price.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bids</p>
            <p className="text-xl font-bold">{auction.bid_count}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isActive ? (
              <>
                <Clock className="h-3 w-3" />
                <span>{timeLeft}</span>
              </>
            ) : (
              <Badge variant="secondary">Ended</Badge>
            )}
          </div>
          {isOwner && (
            <Badge variant="outline" className="text-xs">Your Auction</Badge>
          )}
          {userBid && (
            <Badge variant="outline" className="text-xs">
              Your bid: ${userBid.amount.toFixed(2)}
            </Badge>
          )}
        </div>
      </div>

      {/* Status Indicator */}
      {isActive && (
        <div className="absolute top-4 right-4">
          <div className="h-3 w-3 rounded-full bg-[#EF4444] animate-pulse" />
        </div>
      )}
    </motion.div>
  );
};

export default AuctionCard;
