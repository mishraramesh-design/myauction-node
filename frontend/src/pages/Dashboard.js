import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import AuctionCard from '@/components/AuctionCard';
import NotificationPanel from '@/components/NotificationPanel';
import axios from 'axios';

//const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
//const API = `${BACKEND_URL}/api`;
const API = '/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const socket = useSocket();
  const [activeAuctions, setActiveAuctions] = useState([]);
  const [myAuctions, setMyAuctions] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('new_bid', (data) => {
        // Update auction in real-time
        setActiveAuctions(prev => prev.map(auction => 
          auction.id === data.auction_id 
            ? { ...auction, current_price: data.current_price, bid_count: auction.bid_count + 1 }
            : auction
        ));
        
        setMyAuctions(prev => prev.map(auction => 
          auction.id === data.auction_id 
            ? { ...auction, current_price: data.current_price, bid_count: auction.bid_count + 1 }
            : auction
        ));
      });

      socket.on('auctions_ended', () => {
        fetchData();
      });

      return () => {
        socket.off('new_bid');
        socket.off('auctions_ended');
      };
    }
  }, [socket]);

  const fetchData = async () => {
    try {
      const [auctionsRes, myAuctionsRes, myBidsRes, notificationsRes] = await Promise.all([
        axios.get(`${API}/auctions?status=active`),
        axios.get(`${API}/my-auctions`),
        axios.get(`${API}/my-bids`),
        axios.get(`${API}/notifications`)
      ]);

      setActiveAuctions(auctionsRes.data);
      setMyAuctions(myAuctionsRes.data);
      setMyBids(myBidsRes.data);
      setNotifications(notificationsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border/60 sticky top-0 bg-white z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-3xl font-black tracking-tighter"
              style={{ fontFamily: 'Chivo, sans-serif' }}
            >
              BidFlow
            </motion.div>
            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                data-testid="notifications-button"
                onClick={() => setShowNotifications(!showNotifications)}
                variant="ghost"
                size="icon"
                className="rounded-full relative"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#EF4444] text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
              <Button
                data-testid="create-auction-button"
                onClick={() => navigate('/create-auction')}
                className="rounded-full bg-[#0047FF] hover:bg-[#0047FF]/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Auction
              </Button>
              <Button
                data-testid="logout-button"
                onClick={logout}
                variant="ghost"
                size="icon"
                className="rounded-full"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Panel */}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onUpdate={fetchData}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Tabs defaultValue="active" className="space-y-8">
            <TabsList className="grid w-full max-w-md grid-cols-3 h-12 rounded-full bg-secondary">
              <TabsTrigger 
                data-testid="active-auctions-tab"
                value="active" 
                className="rounded-full"
              >
                Active Auctions
              </TabsTrigger>
              <TabsTrigger 
                data-testid="my-auctions-tab"
                value="my-auctions" 
                className="rounded-full"
              >
                My Auctions
              </TabsTrigger>
              <TabsTrigger 
                data-testid="my-bids-tab"
                value="my-bids" 
                className="rounded-full"
              >
                My Bids
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading auctions...</div>
              ) : activeAuctions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No active auctions yet</p>
                  <Button
                    onClick={() => navigate('/create-auction')}
                    className="rounded-full"
                  >
                    Create First Auction
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeAuctions.map((auction) => (
                    <AuctionCard 
                      key={auction.id} 
                      auction={auction} 
                      onClick={() => navigate(`/auction/${auction.id}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-auctions" className="space-y-6">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading your auctions...</div>
              ) : myAuctions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">You haven't created any auctions</p>
                  <Button
                    onClick={() => navigate('/create-auction')}
                    className="rounded-full"
                  >
                    Create First Auction
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myAuctions.map((auction) => (
                    <AuctionCard 
                      key={auction.id} 
                      auction={auction} 
                      isOwner={true}
                      onClick={() => navigate(`/auction/${auction.id}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-bids" className="space-y-6">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading your bids...</div>
              ) : myBids.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">You haven't placed any bids yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myBids.map(({ bid, auction }) => (
                    <AuctionCard 
                      key={bid.id} 
                      auction={auction}
                      userBid={bid}
                      onClick={() => navigate(`/auction/${auction.id}`)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
