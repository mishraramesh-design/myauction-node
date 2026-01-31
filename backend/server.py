from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-123456789')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=False
)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class AuctionCreate(BaseModel):
    title: str
    description: str
    auction_type: Literal["forward", "reverse"]
    starting_price: float
    bid_increment: float
    end_time: datetime
    image_url: Optional[str] = None

class Auction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    auction_type: Literal["forward", "reverse"]
    starting_price: float
    current_price: float
    bid_increment: float
    creator_id: str
    creator_name: str
    end_time: datetime
    status: Literal["active", "ended"] = "active"
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    bid_count: int = 0
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BidCreate(BaseModel):
    auction_id: str
    amount: float

class Bid(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    auction_id: str
    user_id: str
    user_name: str
    amount: float
    is_auto_bid: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AutoBidCreate(BaseModel):
    auction_id: str
    max_amount: float

class AutoBid(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    auction_id: str
    user_id: str
    max_amount: float
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    message: str
    auction_id: str
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Auth utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserCreate):
    existing = await db.users.find_one({"email": user_input.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password_hash = get_password_hash(user_input.password)
    user = User(email=user_input.email, name=user_input.name)
    
    user_doc = user.model_dump()
    user_doc['password_hash'] = password_hash
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_input: UserLogin):
    user_doc = await db.users.find_one({"email": user_input.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(user_input.password, user_doc['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_doc.pop('password_hash', None)
    user_doc.pop('_id', None)
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**user_doc)
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Auction routes
@api_router.post("/auctions", response_model=Auction)
async def create_auction(auction_input: AuctionCreate, current_user: User = Depends(get_current_user)):
    auction = Auction(
        **auction_input.model_dump(),
        current_price=auction_input.starting_price,
        creator_id=current_user.id,
        creator_name=current_user.name
    )
    
    auction_doc = auction.model_dump()
    auction_doc['end_time'] = auction_doc['end_time'].isoformat()
    auction_doc['created_at'] = auction_doc['created_at'].isoformat()
    
    await db.auctions.insert_one(auction_doc)
    return auction

@api_router.get("/auctions", response_model=List[Auction])
async def get_auctions(
    status: Optional[str] = None,
    auction_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if status:
        query['status'] = status
    if auction_type:
        query['auction_type'] = auction_type
    
    auctions = await db.auctions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for auction in auctions:
        if isinstance(auction.get('end_time'), str):
            auction['end_time'] = datetime.fromisoformat(auction['end_time'])
        if isinstance(auction.get('created_at'), str):
            auction['created_at'] = datetime.fromisoformat(auction['created_at'])
    
    return auctions

@api_router.get("/auctions/{auction_id}", response_model=Auction)
async def get_auction(auction_id: str, current_user: User = Depends(get_current_user)):
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if isinstance(auction.get('end_time'), str):
        auction['end_time'] = datetime.fromisoformat(auction['end_time'])
    if isinstance(auction.get('created_at'), str):
        auction['created_at'] = datetime.fromisoformat(auction['created_at'])
    
    return Auction(**auction)

@api_router.get("/auctions/{auction_id}/bids", response_model=List[Bid])
async def get_auction_bids(auction_id: str, current_user: User = Depends(get_current_user)):
    bids = await db.bids.find({"auction_id": auction_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for bid in bids:
        if isinstance(bid.get('created_at'), str):
            bid['created_at'] = datetime.fromisoformat(bid['created_at'])
    
    return bids

@api_router.get("/my-auctions", response_model=List[Auction])
async def get_my_auctions(current_user: User = Depends(get_current_user)):
    auctions = await db.auctions.find({"creator_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for auction in auctions:
        if isinstance(auction.get('end_time'), str):
            auction['end_time'] = datetime.fromisoformat(auction['end_time'])
        if isinstance(auction.get('created_at'), str):
            auction['created_at'] = datetime.fromisoformat(auction['created_at'])
    
    return auctions

@api_router.get("/my-bids", response_model=List[dict])
async def get_my_bids(current_user: User = Depends(get_current_user)):
    bids = await db.bids.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    auction_ids = list(set([bid['auction_id'] for bid in bids]))
    auctions = await db.auctions.find({"id": {"$in": auction_ids}}, {"_id": 0}).to_list(100)
    auction_map = {a['id']: a for a in auctions}
    
    result = []
    for bid in bids:
        if isinstance(bid.get('created_at'), str):
            bid['created_at'] = datetime.fromisoformat(bid['created_at'])
        
        auction = auction_map.get(bid['auction_id'])
        if auction:
            if isinstance(auction.get('end_time'), str):
                auction['end_time'] = datetime.fromisoformat(auction['end_time'])
            if isinstance(auction.get('created_at'), str):
                auction['created_at'] = datetime.fromisoformat(auction['created_at'])
            
            result.append({
                "bid": bid,
                "auction": auction
            })
    
    return result

# Bidding routes
@api_router.post("/bids", response_model=Bid)
async def place_bid(bid_input: BidCreate, current_user: User = Depends(get_current_user)):
    auction = await db.auctions.find_one({"id": bid_input.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if isinstance(auction['end_time'], str):
        auction['end_time'] = datetime.fromisoformat(auction['end_time'])
    
    if auction['status'] == 'ended' or auction['end_time'] <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    if auction['creator_id'] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot bid on your own auction")
    
    # Validate bid amount
    if auction['auction_type'] == 'forward':
        min_bid = auction['current_price'] + auction['bid_increment']
        if bid_input.amount < min_bid:
            raise HTTPException(status_code=400, detail=f"Bid must be at least {min_bid}")
    else:  # reverse
        max_bid = auction['current_price'] - auction['bid_increment']
        if bid_input.amount > max_bid:
            raise HTTPException(status_code=400, detail=f"Bid must be at most {max_bid}")
    
    # Create bid
    bid = Bid(
        auction_id=bid_input.auction_id,
        user_id=current_user.id,
        user_name=current_user.name,
        amount=bid_input.amount
    )
    
    bid_doc = bid.model_dump()
    bid_doc['created_at'] = bid_doc['created_at'].isoformat()
    await db.bids.insert_one(bid_doc)
    
    # Update auction
    await db.auctions.update_one(
        {"id": bid_input.auction_id},
        {
            "$set": {
                "current_price": bid_input.amount,
                "winner_id": current_user.id,
                "winner_name": current_user.name
            },
            "$inc": {"bid_count": 1}
        }
    )
    
    # Emit WebSocket event
    await sio.emit('new_bid', {
        'auction_id': bid_input.auction_id,
        'bid': bid_doc,
        'current_price': bid_input.amount
    })
    
    # Process auto-bids
    await process_auto_bids(bid_input.auction_id, bid_input.amount, current_user.id)
    
    # Create notification for auction creator
    notification = Notification(
        user_id=auction['creator_id'],
        message=f"{current_user.name} placed a bid of ${bid_input.amount} on {auction['title']}",
        auction_id=bid_input.auction_id
    )
    notif_doc = notification.model_dump()
    notif_doc['created_at'] = notif_doc['created_at'].isoformat()
    await db.notifications.insert_one(notif_doc)
    
    return bid

# Auto-bid routes
@api_router.post("/auto-bids", response_model=AutoBid)
async def create_auto_bid(auto_bid_input: AutoBidCreate, current_user: User = Depends(get_current_user)):
    auction = await db.auctions.find_one({"id": auto_bid_input.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction['creator_id'] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot auto-bid on your own auction")
    
    # Deactivate existing auto-bids for this user on this auction
    await db.auto_bids.update_many(
        {"auction_id": auto_bid_input.auction_id, "user_id": current_user.id},
        {"$set": {"is_active": False}}
    )
    
    auto_bid = AutoBid(
        auction_id=auto_bid_input.auction_id,
        user_id=current_user.id,
        max_amount=auto_bid_input.max_amount
    )
    
    auto_bid_doc = auto_bid.model_dump()
    auto_bid_doc['created_at'] = auto_bid_doc['created_at'].isoformat()
    await db.auto_bids.insert_one(auto_bid_doc)
    
    return auto_bid

@api_router.get("/auto-bids/{auction_id}")
async def get_my_auto_bid(auction_id: str, current_user: User = Depends(get_current_user)):
    auto_bid = await db.auto_bids.find_one(
        {"auction_id": auction_id, "user_id": current_user.id, "is_active": True},
        {"_id": 0}
    )
    if not auto_bid:
        return None
    
    if isinstance(auto_bid.get('created_at'), str):
        auto_bid['created_at'] = datetime.fromisoformat(auto_bid['created_at'])
    
    return auto_bid

async def process_auto_bids(auction_id: str, current_bid: float, current_bidder_id: str):
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        return
    
    # Get all active auto-bids for this auction
    auto_bids = await db.auto_bids.find(
        {"auction_id": auction_id, "is_active": True, "user_id": {"$ne": current_bidder_id}},
        {"_id": 0}
    ).sort("max_amount", -1 if auction['auction_type'] == 'forward' else 1).to_list(10)
    
    for auto_bid in auto_bids:
        # Check if auto-bid should trigger
        should_bid = False
        new_bid_amount = 0
        
        if auction['auction_type'] == 'forward':
            if auto_bid['max_amount'] > current_bid:
                new_bid_amount = min(current_bid + auction['bid_increment'], auto_bid['max_amount'])
                should_bid = True
        else:  # reverse
            if auto_bid['max_amount'] < current_bid:
                new_bid_amount = max(current_bid - auction['bid_increment'], auto_bid['max_amount'])
                should_bid = True
        
        if should_bid:
            # Get user info
            user_doc = await db.users.find_one({"id": auto_bid['user_id']}, {"_id": 0})
            if not user_doc:
                continue
            
            # Place auto-bid
            bid = Bid(
                auction_id=auction_id,
                user_id=auto_bid['user_id'],
                user_name=user_doc['name'],
                amount=new_bid_amount,
                is_auto_bid=True
            )
            
            bid_doc = bid.model_dump()
            bid_doc['created_at'] = bid_doc['created_at'].isoformat()
            await db.bids.insert_one(bid_doc)
            
            # Update auction
            await db.auctions.update_one(
                {"id": auction_id},
                {
                    "$set": {
                        "current_price": new_bid_amount,
                        "winner_id": auto_bid['user_id'],
                        "winner_name": user_doc['name']
                    },
                    "$inc": {"bid_count": 1}
                }
            )
            
            # Emit WebSocket event
            await sio.emit('new_bid', {
                'auction_id': auction_id,
                'bid': bid_doc,
                'current_price': new_bid_amount
            })
            
            # Notify the user who was outbid
            notification = Notification(
                user_id=current_bidder_id,
                message=f"You were outbid on {auction['title']} by an auto-bid",
                auction_id=auction_id
            )
            notif_doc = notification.model_dump()
            notif_doc['created_at'] = notif_doc['created_at'].isoformat()
            await db.notifications.insert_one(notif_doc)
            
            break

# Notification routes
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for notif in notifications:
        if isinstance(notif.get('created_at'), str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"success": True}

# Background task to end auctions
async def check_ended_auctions():
    while True:
        try:
            now = datetime.now(timezone.utc)
            result = await db.auctions.update_many(
                {
                    "status": "active",
                    "end_time": {"$lte": now.isoformat()}
                },
                {"$set": {"status": "ended"}}
            )
            
            if result.modified_count > 0:
                await sio.emit('auctions_ended', {'count': result.modified_count})
        except Exception as e:
            logging.error(f"Error checking ended auctions: {e}")
        
        await asyncio.sleep(10)  # Check every 10 seconds

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(check_ended_auctions())

# WebSocket handlers
@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logging.info(f"Client disconnected: {sid}")

@sio.event
async def join_auction(sid, data):
    auction_id = data.get('auction_id')
    if auction_id:
        sio.enter_room(sid, auction_id)
        logging.info(f"Client {sid} joined auction {auction_id}")

@sio.event
async def leave_auction(sid, data):
    auction_id = data.get('auction_id')
    if auction_id:
        sio.leave_room(sid, auction_id)
        logging.info(f"Client {sid} left auction {auction_id}")

# Include router
app.include_router(api_router)

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap with Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()