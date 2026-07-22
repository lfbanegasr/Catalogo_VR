import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { Card } from '../Card';

export default function AuditoriaScreen() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filterRol, setFilterRol] = useState("");

  const loadLogs = () => {
    api.auditLogs({ rol: filterRol || undefined }).then(setRows).catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadLogs();
  }, [filterRol]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.accion,
        r.email_usuario,
        r.id_tienda,
        r.ip,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [rows, query]);

  return (
    <Card title="Auditoria">
      {error ? <p className="error-text">{error}</p> : null}
      <div className="audit-filters">
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          Buscar en auditoria
          <input
            value={query}
            autoComplete="off"
            placeholder="Accion, usuario, tienda o IP..."
            onChange={(event) => setQuery(event.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          Filtrar por Rol
          <select
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none' }}
          >
            <option value="">Todos los roles</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="empleado">Empleado</option>
          </select>
        </label>
      </div>
      <div className="table-wrap" style={{ marginTop: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
        <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
              <th style={{ padding: '8px' }}>Fecha</th>
              <th style={{ padding: '8px' }}>Accion</th>
              <th style={{ padding: '8px' }}>Usuario</th>
              <th style={{ padding: '8px' }}>Rol</th>
              <th style={{ padding: '8px' }}>Tienda</th>
              <th style={{ padding: '8px' }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px' }}>{new Date(r.fecha_hora.endsWith('Z') ? r.fecha_hora : r.fecha_hora + 'Z').toLocaleString()}</td>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>{r.accion}</td>
                <td style={{ padding: '8px' }}>{r.email_usuario || "-"}</td>
                <td style={{ padding: '8px' }}>
                  {r.rol_usuario ? (
                    <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#e5e7eb', fontSize: '10px' }}>
                      {r.rol_usuario}
                    </span>
                  ) : "-"}
                </td>
                <td style={{ padding: '8px', fontSize: '10px' }}>{r.id_tienda || "-"}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.ip || "-"}</td>
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No hay eventos para esa busqueda.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
