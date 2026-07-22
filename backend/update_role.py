import sys
import os
sys.path.append('d:/3 Proyecto Tienda Virtual/core/backend')
from core.database import SessionLocal
from models.tenant import Usuario
db = SessionLocal()
u = db.query(Usuario).filter(Usuario.email == 'yr3295269@gmail.com').first()
u.rol = 'admin'
db.commit()
print('Updated role')
