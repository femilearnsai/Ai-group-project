"""
Supabase Database Configuration for Authentication
Uses Supabase Python client for database operations
"""

import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables from backend/.env file
backend_dir = Path(__file__).parent.resolve()
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(env_path)

from supabase import create_client, Client

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")  # Use service_role key for backend

# Initialize Supabase client
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase client initialized")
else:
    print("⚠️ Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_KEY environment variables.")


# =============================================
# USER CLASS FOR COMPATIBILITY
# =============================================

class User:
    """User class for compatibility with existing code"""
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id")
        self.email = data.get("email")
        self.username = data.get("username")
        self.password = data.get("password")
        self.auth_provider = data.get("auth_provider", "local")
        self.created_at = self._parse_datetime(data.get("created_at"))
        self.last_login = self._parse_datetime(data.get("last_login"))
        self.is_active = data.get("is_active", True)
    
    def _parse_datetime(self, value):
        """Parse datetime from string or return as-is"""
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except:
            return None
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "password": self.password,
            "auth_provider": self.auth_provider,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "is_active": self.is_active
        }


# =============================================
# DATABASE SESSION COMPATIBILITY
# =============================================

class SupabaseSession:
    """Wrapper class for Supabase to maintain compatibility with existing code"""
    def __init__(self, client: Optional[Client]):
        self.client = client
    
    def close(self):
        """No-op for Supabase (connection pooling handled automatically)"""
        pass


def get_db():
    """Get database session - use as dependency in FastAPI"""
    session = SupabaseSession(supabase)
    try:
        yield session
    finally:
        session.close()


def get_db_session() -> SupabaseSession:
    """Get a new database session - use for direct calls"""
    return SupabaseSession(supabase)


# =============================================
# USER CRUD OPERATIONS
# =============================================

def get_user_by_id(db: SupabaseSession, user_id: str) -> Optional[User]:
    """Get user by ID"""
    if not db.client:
        return None
    
    try:
        response = db.client.table("users").select("*").eq("id", user_id).single().execute()
        if response.data:
            return User(response.data)
        return None
    except Exception as e:
        print(f"Error getting user by ID: {e}")
        return None


def get_user_by_email(db: SupabaseSession, email: str) -> Optional[User]:
    """Get user by email (case-insensitive)"""
    if not db.client:
        return None
    
    try:
        response = db.client.table("users").select("*").eq("email", email.lower()).single().execute()
        if response.data:
            return User(response.data)
        return None
    except Exception as e:
        # User not found is not an error
        if "0 rows" in str(e) or "multiple" not in str(e).lower():
            return None
        print(f"Error getting user by email: {e}")
        return None


def create_user(
    db: SupabaseSession,
    user_id: str,
    email: str,
    username: str,
    password: Optional[str] = None,
    auth_provider: str = "local"
) -> User:
    """Create a new user"""
    if not db.client:
        raise Exception("Supabase client not initialized")
    
    user_data = {
        "id": user_id,
        "email": email.lower(),
        "username": username,
        "password": password,
        "auth_provider": auth_provider,
        "created_at": datetime.utcnow().isoformat(),
        "is_active": True
    }
    
    response = db.client.table("users").insert(user_data).execute()
    
    if response.data:
        return User(response.data[0])
    else:
        raise Exception("Failed to create user")


def update_user_last_login(db: SupabaseSession, user: User) -> User:
    """Update user's last login timestamp"""
    if not db.client:
        return user
    
    try:
        now = datetime.utcnow().isoformat()
        response = db.client.table("users").update(
            {"last_login": now}
        ).eq("id", user.id).execute()
        
        if response.data:
            return User(response.data[0])
        return user
    except Exception as e:
        print(f"Error updating last login: {e}")
        return user


# =============================================
# TABLE CREATION SQL (Run in Supabase SQL Editor)
# =============================================

SUPABASE_TABLE_SQL = """
-- Create users table in Supabase
-- Run this SQL in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(30) NOT NULL,
    password VARCHAR(64),
    auth_provider VARCHAR(20) DEFAULT 'local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access" ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);
"""

def print_setup_instructions():
    """Print setup instructions for Supabase"""
    print("""
╔══════════════════════════════════════════════════════════════════╗
║                    SUPABASE SETUP INSTRUCTIONS                   ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1. Create a Supabase project at https://supabase.com            ║
║                                                                  ║
║  2. Go to Project Settings > API and copy:                       ║
║     - Project URL (SUPABASE_URL)                                 ║
║     - service_role key (SUPABASE_KEY) - NOT the anon key         ║
║                                                                  ║
║  3. Set environment variables:                                   ║
║     SUPABASE_URL=https://your-project.supabase.co                ║
║     SUPABASE_KEY=your-service-role-key                           ║
║                                                                  ║
║  4. Run the following SQL in Supabase SQL Editor:                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
    print(SUPABASE_TABLE_SQL)


# Print setup instructions if Supabase is not configured
if not supabase:
    print_setup_instructions()
