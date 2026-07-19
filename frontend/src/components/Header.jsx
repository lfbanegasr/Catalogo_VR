function Header({ title, subtitle }) {
  return (
    <header className="hero">
      <div>
        <p className="hero-kicker">Catalogo publico</p>
        <h1 className="hero-title">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
      </div>
    </header>
  );
}

export default Header;
