from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# PostgreSQL connection
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@localhost:5432/auction_db')

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# SQLAlchemy Base
Base = declarative_base()

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

# SQLAlchemy Models
class UserDB(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuctionDB(Base):
    __tablename__ = "auctions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    auction_type = Column(String, nullable=False)  # forward or reverse
    starting_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    bid_increment = Column(Float, nullable=False)
    creator_id = Column(String, ForeignKey('users.id'), nullable=False)
    creator_name = Column(String, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default="active")  # active or ended
    winner_id = Column(String, nullable=True)
    winner_name = Column(String, nullable=True)
    bid_count = Column(Integer, default=0)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class BidDB(Base):
    __tablename__ = "bids"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    auction_id = Column(String, ForeignKey('auctions.id'), nullable=False, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    user_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    is_auto_bid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AutoBidDB(Base):
    __tablename__ = "auto_bids"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    auction_id = Column(String, ForeignKey('auctions.id'), nullable=False, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    max_amount = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class NotificationDB(Base):
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.id'), nullable=False, index=True)
    message = Column(Text, nullable=False)
    auction_id = Column(String, ForeignKey('auctions.id'), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# Pydantic Models for API
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: datetime
    
    class Config:
        from_attributes = True

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
    id: str
    title: str
    description: str
    auction_type: Literal["forward", "reverse"]
    starting_price: float
    current_price: float
    bid_increment: float
    creator_id: str
    creator_name: str
    end_time: datetime
    status: Literal["active", "ended"]
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    bid_count: int
    image_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class BidCreate(BaseModel):
    auction_id: str
    amount: float

class Bid(BaseModel):
    id: str
    auction_id: str
    user_id: str
    user_name: str
    amount: float
    is_auto_bid: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class AutoBidCreate(BaseModel):
    auction_id: str
    max_amount: float

class AutoBid(BaseModel):
    id: str
    auction_id: str
    user_id: str
    max_amount: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Notification(BaseModel):
    id: str
    user_id: str
    message: str
    auction_id: str
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Database dependency
async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

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

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    result = await db.execute(select(UserDB).where(UserDB.id == user_id))
    user_db = result.scalar_one_or_none()
    
    if user_db is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User.model_validate(user_db)

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(UserDB).where(UserDB.email == user_input.email))
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    password_hash = get_password_hash(user_input.password)
    user_db = UserDB(
        email=user_input.email,
        name=user_input.name,
        password_hash=password_hash
    )
    
    db.add(user_db)
    await db.commit()
    await db.refresh(user_db)
    
    user = User.model_validate(user_db)
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_input: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == user_input.email))
    user_db = result.scalar_one_or_none()
    
    if not user_db or not verify_password(user_input.password, user_db.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User.model_validate(user_db)
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Auction routes
@api_router.post("/auctions", response_model=Auction)
async def create_auction(
    auction_input: AuctionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auction_db = AuctionDB(
        title=auction_input.title,
        description=auction_input.description,
        auction_type=auction_input.auction_type,
        starting_price=auction_input.starting_price,
        current_price=auction_input.starting_price,
        bid_increment=auction_input.bid_increment,
        end_time=auction_input.end_time,
        image_url=auction_input.image_url,
        creator_id=current_user.id,
        creator_name=current_user.name
    )
    
    db.add(auction_db)
    await db.commit()
    await db.refresh(auction_db)
    
    return Auction.model_validate(auction_db)

@api_router.get("/auctions", response_model=List[Auction])
async def get_auctions(
    status: Optional[str] = None,
    auction_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AuctionDB)
    
    if status:
        query = query.where(AuctionDB.status == status)
    if auction_type:
        query = query.where(AuctionDB.auction_type == auction_type)
    
    query = query.order_by(AuctionDB.created_at.desc())
    result = await db.execute(query)
    auctions = result.scalars().all()
    
    return [Auction.model_validate(a) for a in auctions]

@api_router.get("/auctions/{auction_id}", response_model=Auction)
async def get_auction(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    auction_db = result.scalar_one_or_none()
    
    if not auction_db:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    return Auction.model_validate(auction_db)

@api_router.get("/auctions/{auction_id}/bids", response_model=List[Bid])
async def get_auction_bids(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(BidDB)
        .where(BidDB.auction_id == auction_id)
        .order_by(BidDB.created_at.desc())
    )
    bids = result.scalars().all()
    
    return [Bid.model_validate(b) for b in bids]

@api_router.get("/my-auctions", response_model=List[Auction])
async def get_my_auctions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuctionDB)
        .where(AuctionDB.creator_id == current_user.id)
        .order_by(AuctionDB.created_at.desc())
    )
    auctions = result.scalars().all()
    
    return [Auction.model_validate(a) for a in auctions]

@api_router.get("/my-bids", response_model=List[dict])
async def get_my_bids(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(BidDB)
        .where(BidDB.user_id == current_user.id)
        .order_by(BidDB.created_at.desc())
    )
    bids = result.scalars().all()
    
    # Get unique auction IDs
    auction_ids = list(set([bid.auction_id for bid in bids]))
    
    # Fetch auctions
    auctions_result = await db.execute(
        select(AuctionDB).where(AuctionDB.id.in_(auction_ids))
    )
    auctions = {a.id: a for a in auctions_result.scalars().all()}
    
    # Combine results
    result_list = []
    for bid in bids:
        if bid.auction_id in auctions:
            result_list.append({
                "bid": Bid.model_validate(bid).model_dump(),
                "auction": Auction.model_validate(auctions[bid.auction_id]).model_dump()
            })
    
    return result_list

# Bidding routes
@api_router.post("/bids", response_model=Bid)
async def place_bid(
    bid_input: BidCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get auction
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == bid_input.auction_id))
    auction = result.scalar_one_or_none()
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.status == 'ended' or auction.end_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    if auction.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot bid on your own auction")
    
    # Validate bid amount
    if auction.auction_type == 'forward':
        min_bid = auction.current_price + auction.bid_increment
        if bid_input.amount < min_bid:
            raise HTTPException(status_code=400, detail=f"Bid must be at least {min_bid}")
    else:  # reverse
        max_bid = auction.current_price - auction.bid_increment
        if bid_input.amount > max_bid:
            raise HTTPException(status_code=400, detail=f"Bid must be at most {max_bid}")
    
    # Create bid
    bid_db = BidDB(
        auction_id=bid_input.auction_id,
        user_id=current_user.id,
        user_name=current_user.name,
        amount=bid_input.amount
    )
    
    db.add(bid_db)
    
    # Update auction
    auction.current_price = bid_input.amount
    auction.winner_id = current_user.id
    auction.winner_name = current_user.name
    auction.bid_count += 1
    
    await db.commit()
    await db.refresh(bid_db)
    
    # Emit WebSocket event
    await sio.emit('new_bid', {
        'auction_id': bid_input.auction_id,
        'bid': Bid.model_validate(bid_db).model_dump(mode='json'),
        'current_price': bid_input.amount
    })
    
    # Process auto-bids
    await process_auto_bids(bid_input.auction_id, bid_input.amount, current_user.id, db)
    
    # Create notification
    notif_db = NotificationDB(
        user_id=auction.creator_id,
        message=f"{current_user.name} placed a bid of ${bid_input.amount} on {auction.title}",
        auction_id=bid_input.auction_id
    )
    db.add(notif_db)
    await db.commit()
    
    return Bid.model_validate(bid_db)

# Auto-bid routes
@api_router.post("/auto-bids", response_model=AutoBid)
async def create_auto_bid(
    auto_bid_input: AutoBidCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auto_bid_input.auction_id))
    auction = result.scalar_one_or_none()
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot auto-bid on your own auction")
    
    # Deactivate existing auto-bids
    await db.execute(
        select(AutoBidDB)
        .where(AutoBidDB.auction_id == auto_bid_input.auction_id)
        .where(AutoBidDB.user_id == current_user.id)
    )
    result = await db.execute(
        select(AutoBidDB)
        .where(AutoBidDB.auction_id == auto_bid_input.auction_id)
        .where(AutoBidDB.user_id == current_user.id)
    )
    existing_bids = result.scalars().all()
    for bid in existing_bids:
        bid.is_active = False
    
    # Create new auto-bid
    auto_bid_db = AutoBidDB(
        auction_id=auto_bid_input.auction_id,
        user_id=current_user.id,
        max_amount=auto_bid_input.max_amount
    )
    
    db.add(auto_bid_db)
    await db.commit()
    await db.refresh(auto_bid_db)
    
    return AutoBid.model_validate(auto_bid_db)

@api_router.get("/auto-bids/{auction_id}")
async def get_my_auto_bid(
    auction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AutoBidDB)
        .where(AutoBidDB.auction_id == auction_id)
        .where(AutoBidDB.user_id == current_user.id)
        .where(AutoBidDB.is_active == True)
    )
    auto_bid = result.scalar_one_or_none()
    
    if not auto_bid:
        return None
    
    return AutoBid.model_validate(auto_bid)

async def process_auto_bids(auction_id: str, current_bid: float, current_bidder_id: str, db: AsyncSession):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    auction = result.scalar_one_or_none()
    
    if not auction:
        return
    
    # Get active auto-bids
    query = select(AutoBidDB).where(
        AutoBidDB.auction_id == auction_id,
        AutoBidDB.is_active == True,
        AutoBidDB.user_id != current_bidder_id
    )
    
    if auction.auction_type == 'forward':
        query = query.order_by(AutoBidDB.max_amount.desc())
    else:
        query = query.order_by(AutoBidDB.max_amount.asc())
    
    result = await db.execute(query)
    auto_bids = result.scalars().all()
    
    for auto_bid in auto_bids:
        should_bid = False
        new_bid_amount = 0
        
        if auction.auction_type == 'forward':
            if auto_bid.max_amount > current_bid:
                new_bid_amount = min(current_bid + auction.bid_increment, auto_bid.max_amount)
                should_bid = True
        else:  # reverse
            if auto_bid.max_amount < current_bid:
                new_bid_amount = max(current_bid - auction.bid_increment, auto_bid.max_amount)
                should_bid = True
        
        if should_bid:
            # Get user
            user_result = await db.execute(select(UserDB).where(UserDB.id == auto_bid.user_id))
            user = user_result.scalar_one_or_none()
            
            if not user:
                continue
            
            # Place auto-bid
            bid_db = BidDB(
                auction_id=auction_id,
                user_id=auto_bid.user_id,
                user_name=user.name,
                amount=new_bid_amount,
                is_auto_bid=True
            )
            
            db.add(bid_db)
            
            # Update auction
            auction.current_price = new_bid_amount
            auction.winner_id = auto_bid.user_id
            auction.winner_name = user.name
            auction.bid_count += 1
            
            await db.commit()
            await db.refresh(bid_db)
            
            # Emit WebSocket event
            await sio.emit('new_bid', {
                'auction_id': auction_id,
                'bid': Bid.model_validate(bid_db).model_dump(mode='json'),
                'current_price': new_bid_amount
            })
            
            # Notify outbid user
            notif_db = NotificationDB(
                user_id=current_bidder_id,
                message=f"You were outbid on {auction.title} by an auto-bid",
                auction_id=auction_id
            )
            db.add(notif_db)
            await db.commit()
            
            break

# Notification routes
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(NotificationDB)
        .where(NotificationDB.user_id == current_user.id)
        .order_by(NotificationDB.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()
    
    return [Notification.model_validate(n) for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(NotificationDB)
        .where(NotificationDB.id == notification_id)
        .where(NotificationDB.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    await db.commit()
    
    return {"success": True}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(NotificationDB)
        .where(NotificationDB.user_id == current_user.id)
        .where(NotificationDB.is_read == False)
    )
    notifications = result.scalars().all()
    
    for notif in notifications:
        notif.is_read = True
    
    await db.commit()
    return {"success": True}

# Background task to end auctions
async def check_ended_auctions():
    while True:
        try:
            async with async_session_maker() as db:
                now = datetime.now(timezone.utc)
                result = await db.execute(
                    select(AuctionDB)
                    .where(AuctionDB.status == "active")
                    .where(AuctionDB.end_time <= now)
                )
                auctions = result.scalars().all()
                
                count = 0
                for auction in auctions:
                    auction.status = "ended"
                    count += 1
                
                if count > 0:
                    await db.commit()
                    await sio.emit('auctions_ended', {'count': count})
        except Exception as e:
            logging.error(f"Error checking ended auctions: {e}")
        
        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Start background task
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
