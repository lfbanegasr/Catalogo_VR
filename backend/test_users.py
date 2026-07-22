import sys
import os
sys.path.append('d:/3 Proyecto Tienda Virtual/core/backend')
from core.database import SessionLocal
from models.tenant import Usuario
db = SessionLocal()
users = db.query(Usuario).all()
for u in users:
    print(f"User: {u.email}, Rol: '{u.rol}'")
