import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Zap, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuctionDetail() {
  const navigate = useNavigate();
  const { auctionId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [maxBidAmount, setMaxBidAmount] = useState('');
  const [autoBid, setAutoBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    fetchAuctionData();
  }, [auctionId]);

  useEffect(() => {
    if (socket && auctionId) {
      socket.emit('join_auction', { auction_id: auctionId });

      socket.on('new_bid', (data) => {
        if (data.auction_id === auctionId) {
          setAuction(prev => ({
            ...prev,
            current_price: data.current_price,
            bid_count: prev.bid_count + 1
          }));
          
          setBids(prev => [data.bid, ...prev]);
          
          toast.info(`New bid: $${data.current_price}`, {
            description: data.bid.is_auto_bid ? 'Auto-bid placed' : `Bid by ${data.bid.user_name}`
          });
        }
      });

      return () => {
        socket.emit('leave_auction', { auction_id: auctionId });
        socket.off('new_bid');
      };
    }
  }, [socket, auctionId]);

  useEffect(() => {
    if (auction && auction.status === 'active') {
      const interval = setInterval(() => {
        const now = new Date();
        const end = new Date(auction.end_time);
        const diff = end - now;

        if (diff <= 0) {
          setTimeLeft('Auction ended');
          clearInterval(interval);
        } else {
          setTimeLeft(formatDistanceToNow(end, { addSuffix: true }));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [auction]);

  const fetchAuctionData = async () => {
    try {
      const [auctionRes, bidsRes, autoBidRes] = await Promise.all([
        axios.get(`${API}/auctions/${auctionId}`),
        axios.get(`${API}/auctions/${auctionId}/bids`),
        axios.get(`${API}/auto-bids/${auctionId}`)
      ]);

      setAuction(auctionRes.data);
      setBids(bidsRes.data);
      setAutoBid(autoBidRes.data);
      
      // Set suggested bid amount
      const suggested = auctionRes.data.auction_type === 'forward'
        ? auctionRes.data.current_price + auctionRes.data.bid_increment
        : auctionRes.data.current_price - auctionRes.data.bid_increment;
      setBidAmount(suggested.toFixed(2));
    } catch (error) {
      console.error('Failed to fetch auction data:', error);
      toast.error('Failed to load auction');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!bidAmount || isNaN(bidAmount)) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    setBidding(true);
    try {
      await axios.post(`${API}/bids`, {
        auction_id: auctionId,
        amount: parseFloat(bidAmount)
      });

      toast.success('Bid placed successfully!');
      fetchAuctionData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place bid');
    } finally {
      setBidding(false);
    }
  };

  const handleSetAutoBid = async () => {
    if (!maxBidAmount || isNaN(maxBidAmount)) {
      toast.error('Please enter a valid maximum bid amount');
      return;
    }

    try {
      await axios.post(`${API}/auto-bids`, {
        auction_id: auctionId,
        max_amount: parseFloat(maxBidAmount)
      });

      toast.success('Auto-bid set successfully!');
      fetchAuctionData();
      setMaxBidAmount('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to set auto-bid');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-muted-foreground">Loading auction...</div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Auction not found</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isOwner = auction.creator_id === user?.id;
  const isActive = auction.status === 'active' && new Date(auction.end_time) > new Date();
  const minNextBid = auction.auction_type === 'forward'
    ? auction.current_price + auction.bid_increment
    : auction.current_price - auction.bid_increment;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20">
            <Button
              data-testid="back-to-dashboard-button"
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="icon"
              className="rounded-full mr-4"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 
              className="text-2xl font-black tracking-tighter"
              style={{ fontFamily: 'Chivo, sans-serif' }}
            >
              Auction Details
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Auction Info */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-white overflow-hidden"
            >
              {auction.image_url && (
                <img
                  src={auction.image_url}
                  alt={auction.title}
                  className="w-full h-96 object-cover"
                />
              )}
              <div className="p-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Chivo, sans-serif' }}>
                      {auction.title}
                    </h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {auction.creator_name}
                    </p>
                  </div>
                  <Badge 
                    variant={auction.auction_type === 'forward' ? 'default' : 'secondary'}
                    className="text-sm px-4 py-1"
                  >
                    {auction.auction_type === 'forward' ? (
                      <><TrendingUp className="h-3 w-3 mr-1" /> Forward</>
                    ) : (
                      <><TrendingDown className="h-3 w-3 mr-1" /> Reverse</>
                    )}
                  </Badge>
                </div>

                <p className="text-muted-foreground leading-relaxed mb-6">
                  {auction.description}
                </p>

                <Separator className="my-6" />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-xl bg-secondary/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Price</p>
                    <p 
                      className="text-2xl font-bold"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      ${auction.current_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-secondary/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bid Increment</p>
                    <p 
                      className="text-2xl font-bold"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      ${auction.bid_increment.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-secondary/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Bids</p>
                    <p 
                      className="text-2xl font-bold"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {auction.bid_count}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-secondary/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                    <p className="text-lg font-bold">
                      {isActive ? (
                        <Badge className="bg-[#10B981]">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Ended</Badge>
                      )}
                    </p>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-6 p-4 rounded-xl bg-[#0047FF]/10 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-[#0047FF]" />
                    <div>
                      <p className="text-sm font-semibold">Time Remaining</p>
                      <p className="text-sm text-muted-foreground">{timeLeft}</p>
                    </div>
                  </div>
                )}

                {!isActive && auction.winner_name && (
                  <div className="mt-6 p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30">
                    <p className="text-sm font-semibold mb-1">Winner</p>
                    <p className="text-lg font-bold">{auction.winner_name}</p>
                    <p className="text-sm text-muted-foreground">Winning bid: ${auction.current_price.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Bid History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-border bg-white p-8"
            >
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>
                Bid History
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {bids.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No bids yet</p>
                ) : (
                  bids.map((bid) => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#0047FF]/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-[#0047FF]" />
                        </div>
                        <div>
                          <p className="font-semibold">{bid.user_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(bid.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {bid.is_auto_bid && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
                      <div 
                        className="text-xl font-bold"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        ${bid.amount.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Bidding */}
          <div className="space-y-6">
            {!isOwner && isActive && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-border bg-white p-6 space-y-6 sticky top-24"
              >
                {/* Place Bid */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    Place Bid
                  </h3>
                  <div className="space-y-2">
                    <Label>Bid Amount</Label>
                    <Input
                      data-testid="bid-amount-input"
                      type="number"
                      step="0.01"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={minNextBid.toFixed(2)}
                      className="h-12 text-lg font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum: ${minNextBid.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    data-testid="place-bid-button"
                    onClick={handlePlaceBid}
                    disabled={bidding}
                    className="w-full h-12 rounded-full font-bold bg-[#0047FF] hover:bg-[#0047FF]/90"
                  >
                    {bidding ? 'Placing Bid...' : 'Place Bid'}
                  </Button>
                </div>

                <Separator />

                {/* Auto-Bid */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-[#F59E0B]" />
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
                      Auto-Bid
                    </h3>
                  </div>
                  
                  {autoBid ? (
                    <div className="p-4 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30">
                      <p className="text-sm font-semibold mb-1">Active Auto-Bid</p>
                      <p className="text-xl font-bold">${autoBid.max_amount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        System will automatically bid up to this amount
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Maximum Bid Amount</Label>
                      <Input
                        data-testid="auto-bid-amount-input"
                        type="number"
                        step="0.01"
                        value={maxBidAmount}
                        onChange={(e) => setMaxBidAmount(e.target.value)}
                        placeholder="Enter max amount"
                        className="h-12 text-lg font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Set the maximum you're willing to pay. The system will bid for you.
                      </p>
                      <Button
                        data-testid="set-auto-bid-button"
                        onClick={handleSetAutoBid}
                        variant="outline"
                        className="w-full h-12 rounded-full font-bold"
                      >
                        Set Auto-Bid
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {isOwner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-border bg-white p-6"
              >
                <p className="text-sm text-muted-foreground text-center">
                  You are the creator of this auction
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
