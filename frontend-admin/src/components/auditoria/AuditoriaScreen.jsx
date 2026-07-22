import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { Card } from '../Card';

export default function AuditoriaScreen() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filterRol, setFilterRol] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadLogs = () => {
    api.auditLogs({ rol: filterRol || undefined, startDate, endDate }).then(setRows).catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadLogs();
  }, [filterRol, startDate, endDate]);

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
      <div className="audit-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>Buscar</span>
          <input
            value={query}
            autoComplete="off"
            placeholder="Accion, usuario, tienda o IP..."
            onChange={(event) => setQuery(event.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>Filtrar por Rol</span>
          <select
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none', width: '100%' }}
          >
            <option value="">Todos los roles</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="empleado">Empleado</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>Desde fecha</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>Hasta fecha</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '12px', outline: 'none', width: '100%' }}
          />
        </label>
      </div>
      <div className="table-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid #f3f4f6', borderRadius: '8px' }}>
        <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Fecha</th>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Accion</th>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Usuario</th>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Rol</th>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>Tienda</th>
              <th style={{ padding: '12px 16px', fontWeight: '600' }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff' }}>
                <td style={{ padding: '12px 16px' }}>{new Date(r.fecha_hora.endsWith('Z') ? r.fecha_hora : r.fecha_hora + 'Z').toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827' }}>{r.accion}</td>
                <td style={{ padding: '12px 16px' }}>{r.email_usuario || "-"}</td>
                <td style={{ padding: '12px 16px' }}>
                  {r.rol_usuario ? (
                    <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#f3f4f6', fontSize: '11px', fontWeight: '500', color: '#4b5563' }}>
                      {r.rol_usuario}
                    </span>
                  ) : "-"}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6b7280' }}>{r.id_tienda ? r.id_tienda.split('-')[0] + "..." : "-"}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6b7280' }}>{r.ip || "-"}</td>
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
