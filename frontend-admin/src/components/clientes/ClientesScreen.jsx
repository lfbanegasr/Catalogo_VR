import { useEffect, useState } from "react";
import { api } from "../../api";
import { Card } from "../Card";

function formatMoney(value) {
  return Number(value || 0).toFixed(2) + " Bs";
}

export default function ClientesScreen({ user }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async (query = search) => {
    setLoading(true);
    setError("");
    try {
      setClients(await api.listClientes(query.trim(), user.id_tienda));
    } catch (requestError) {
      setError(requestError.message || "No se pudieron cargar los clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, [user.id_tienda]);

  const openClient = async (idCliente) => {
    setError("");
    try {
      setSelected(await api.getCliente(idCliente, user.id_tienda));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveClient = async () => {
    if (!selected || !["admin", "superadmin"].includes(user.rol)) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateCliente(selected.id_cliente, {
        nombre_completo: selected.nombre_completo,
        telefono: selected.telefono || null,
        email: selected.email || null,
        ciudad_region: selected.ciudad_region || null,
        notas: selected.notas || null,
      }, user.id_tienda);
      setSelected(updated);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <Card title="Clientes">
        <div className="catalog-toolbar">
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              load();
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, telefono o correo"
            />
            <button className="btn btn-primary" type="submit">Buscar</button>
            <button className="btn btn-ghost" type="button" onClick={() => {
              setSearch("");
              load("");
            }}>Limpiar</button>
          </form>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p className="muted">Cargando clientes...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Pedidos</th>
                  <th>Total comprado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id_cliente}>
                    <td className="font-semibold">{client.nombre_completo}</td>
                    <td>
                      <div>{client.telefono || "-"}</div>
                      <div className="muted small">{client.email || ""}</div>
                    </td>
                    <td>{client.total_pedidos}</td>
                    <td>{formatMoney(client.total_comprado)}</td>
                    <td>
                      <button className="btn btn-ghost" type="button" onClick={() => openClient(client.id_cliente)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clients.length === 0 ? <p className="muted">No se encontraron clientes.</p> : null}
          </div>
        )}
      </Card>

      {selected ? (
        <Card title={"Ficha de " + selected.nombre_completo}>
          <div className="grid-form">
            <label>Nombre
              <input
                value={selected.nombre_completo || ""}
                disabled={!["admin", "superadmin"].includes(user.rol)}
                onChange={(event) => setSelected((current) => ({ ...current, nombre_completo: event.target.value }))}
              />
            </label>
            <label>Telefono
              <input
                value={selected.telefono || ""}
                disabled={!["admin", "superadmin"].includes(user.rol)}
                onChange={(event) => setSelected((current) => ({ ...current, telefono: event.target.value }))}
              />
            </label>
            <label>Correo
              <input
                type="email"
                value={selected.email || ""}
                disabled={!["admin", "superadmin"].includes(user.rol)}
                onChange={(event) => setSelected((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>Ciudad o region
              <input
                value={selected.ciudad_region || ""}
                disabled={!["admin", "superadmin"].includes(user.rol)}
                onChange={(event) => setSelected((current) => ({ ...current, ciudad_region: event.target.value }))}
              />
            </label>
            <label>Notas internas
              <textarea
                value={selected.notas || ""}
                disabled={!["admin", "superadmin"].includes(user.rol)}
                onChange={(event) => setSelected((current) => ({ ...current, notas: event.target.value }))}
              />
            </label>
            <div className="row">
              <span className="chip">{selected.total_pedidos} pedidos</span>
              <span className="chip">{formatMoney(selected.total_comprado)}</span>
            </div>
            {["admin", "superadmin"].includes(user.rol) ? (
              <button className="btn btn-primary" type="button" disabled={saving} onClick={saveClient}>
                {saving ? "Guardando..." : "Guardar cliente"}
              </button>
            ) : null}
          </div>

          <h4>Direcciones guardadas</h4>
          <div className="catalog-grid">
            {(selected.direcciones || []).map((address) => (
              <article key={address.id_direccion} className="panel">
                <strong>{address.etiqueta}{address.es_predeterminada ? " ? Principal" : ""}</strong>
                <p>{address.linea1}</p>
                <p className="muted small">
                  {[address.ciudad, address.region].filter(Boolean).join(", ")}
                </p>
                {address.referencia ? <p className="muted small">{address.referencia}</p> : null}
              </article>
            ))}
            {(selected.direcciones || []).length === 0 ? (
              <p className="muted">Este cliente todavia no tiene direcciones guardadas.</p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
