import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CreateAuction() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    auction_type: 'forward',
    starting_price: '',
    bid_increment: '',
    duration_hours: '24',
    image_url: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + parseInt(formData.duration_hours));

      await axios.post(`${API}/auctions`, {
        title: formData.title,
        description: formData.description,
        auction_type: formData.auction_type,
        starting_price: parseFloat(formData.starting_price),
        bid_increment: parseFloat(formData.bid_increment),
        end_time: endTime.toISOString(),
        image_url: formData.image_url || null
      });

      toast.success('Auction created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20">
            <Button
              data-testid="back-button"
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
              Create New Auction
            </h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-white p-8 shadow-sm"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Auction Type */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Auction Type</Label>
              <RadioGroup
                value={formData.auction_type}
                onValueChange={(value) => setFormData({ ...formData, auction_type: value })}
              >
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem data-testid="forward-auction-radio" value="forward" id="forward" />
                  <Label htmlFor="forward" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Forward Auction</div>
                    <div className="text-sm text-muted-foreground">Highest bid wins - price increases</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-secondary/50 transition-colors">
                  <RadioGroupItem data-testid="reverse-auction-radio" value="reverse" id="reverse" />
                  <Label htmlFor="reverse" className="flex-1 cursor-pointer">
                    <div className="font-semibold">Reverse Auction</div>
                    <div className="text-sm text-muted-foreground">Lowest bid wins - price decreases</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Auction Title</Label>
              <Input
                data-testid="auction-title-input"
                id="title"
                placeholder="e.g., Vintage Watch Collection"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="h-12"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                data-testid="auction-description-input"
                id="description"
                placeholder="Describe your item or service..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={4}
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image_url">Image URL (Optional)</Label>
              <Input
                data-testid="auction-image-url-input"
                id="image_url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="h-12"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="starting_price">Starting Price ($)</Label>
                <Input
                  data-testid="starting-price-input"
                  id="starting_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="100.00"
                  value={formData.starting_price}
                  onChange={(e) => setFormData({ ...formData, starting_price: e.target.value })}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bid_increment">Bid Increment ($)</Label>
                <Input
                  data-testid="bid-increment-input"
                  id="bid_increment"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="5.00"
                  value={formData.bid_increment}
                  onChange={(e) => setFormData({ ...formData, bid_increment: e.target.value })}
                  required
                  className="h-12"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration_hours">Duration (Hours)</Label>
              <Input
                data-testid="duration-input"
                id="duration_hours"
                type="number"
                min="1"
                max="168"
                placeholder="24"
                value={formData.duration_hours}
                onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                required
                className="h-12"
              />
              <p className="text-sm text-muted-foreground">Maximum 168 hours (7 days)</p>
            </div>

            {/* Submit */}
            <Button
              data-testid="create-auction-submit-button"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full font-bold bg-[#0047FF] hover:bg-[#0047FF]/90"
            >
              {loading ? 'Creating...' : 'Create Auction'}
            </Button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
