import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const NotificationPanel = ({ notifications, onClose, onUpdate }) => {
  const navigate = useNavigate();

  const handleMarkRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      onUpdate();
    } catch (error) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`);
      toast.success('All notifications marked as read');
      onUpdate();
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      handleMarkRead(notification.id);
    }
    navigate(`/auction/${notification.auction_id}`);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md h-[calc(100vh-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Chivo, sans-serif' }}>
                Notifications
              </h2>
              {notifications.filter(n => !n.is_read).length > 0 && (
                <Badge className="bg-[#EF4444]">
                  {notifications.filter(n => !n.is_read).length}
                </Badge>
              )}
            </div>
            <Button
              data-testid="close-notifications-button"
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mark All Read Button */}
          {notifications.filter(n => !n.is_read).length > 0 && (
            <div className="px-6 py-3 border-b border-border">
              <Button
                data-testid="mark-all-read-button"
                onClick={handleMarkAllRead}
                variant="ghost"
                size="sm"
                className="text-sm"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark all as read
              </Button>
            </div>
          )}

          {/* Notifications List */}
          <ScrollArea className="flex-1 p-6">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    data-testid={`notification-${notification.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-secondary/50 ${
                      notification.is_read 
                        ? 'border-border bg-white' 
                        : 'border-[#0047FF]/30 bg-[#0047FF]/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm flex-1">{notification.message}</p>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-[#0047FF] shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationPanel;
